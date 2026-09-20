# GTR POS - Security Specification & Threat Model (ABAC & Zero-Trust)

This document defines the data invariants, threat vectors, and verification payloads used to secure and validate the GTR POS Google Cloud Firestore database under a strict Zero-Trust paradigm.

## 1. Core Data Invariants
1. **Unmodifiable Administrative Configuration**: Only users authenticated as `admin` (verified via secure `/users/{userId}` server-authoritative roles) can read or write security-sensitive directories, system settings, or caja closure summaries.
2. **Strict User Separation**: A cashier (`cajero`) or general user cannot modify their own `role` or `permissions` attributes. These are immutable at the document-level unless write requests are executed by a verified Administrator.
3. **Immutable Transactions**: Once a sale or sale item is registered, it cannot be modified or deleted by non-administrators. This ensures full auditing.
4. **Verified Identity Integrity**: Any write to a user-owned document must enforce that the document's author UID field matches the current authenticated `request.auth.uid`.
5. **Denial of Wallet Protection**: All collection paths must enforce string size controls, key validation regex limits, and execution-order guards to minimize document-fetch billing costs during speculative attacks.

---

## 2. The "Dirty Dozen" Malicious Payloads
The following payloads describe 12 malicious attacks designed to bypass system logic. Our applied Firestore rules mathematically ensure that every single one of these yields `PERMISSION_DENIED`.

### Attack 1: Self-Privilege Escalation
* **Vector**: A general cashier tries to elevate their status to admin by changing their user role.
* **Malicious Payload**:
```json
{
  "username": "cashier_john",
  "role": "admin",
  "permissions": "{\"isAdmin\":true}"
}
```
* **Expected Result**: **PERMISSION_DENIED** (Role attribute modification blocked on read/write).

### Attack 2: Identity Spoofing (Owner Hijack)
* **Vector**: An active user attempts to insert a transaction attributing it to another helper.
* **Malicious Payload**:
```json
{
  "total": 950.00,
  "payment_method": "Efectivo",
  "user_id": "9999_someone_else",
  "exchange_rate": 36.50
}
```
* **Expected Result**: **PERMISSION_DENIED** (The field `user_id` inside incoming transaction payload does not match the active worker's credentials).

### Attack 3: Resource Poisoning (ID Injection)
* **Vector**: Attacker tries to inject high-byte characters or huge payload blobs into the Product ID parameter to exhaust resource quotas.
* **Malicious Path / Document ID**:
```
/products/prod_$$$_MALICIOUS_RESOURCE_EXHAUSTION_ATTACK_STRING_WITH_OVER_2000_BYTES_BLOB_$$$
```
* **Expected Result**: **PERMISSION_DENIED** (`isValidId()` constraint blocks lengths exceeding 128 characters and non-validated character sets).

### Attack 4: Transaction Back-dating / Temporal Hack
* **Vector**: Cashier attempts to fake a historic transaction timestamp back in time to alter cash register calculations.
* **Malicious Payload**:
```json
{
  "total": 120.00,
  "payment_method": "Efectivo",
  "user_id": "active_user_uid",
  "created_at": "2020-01-01T00:00:00.000Z"
}
```
* **Expected Result**: **PERMISSION_DENIED** (Transaction timestamp must strictly equal `request.time`).

### Attack 5: Unbounded List Injection
* **Vector**: Attempting to bypass the relational sync limit by updating a product line with an array of 5,000 tag items.
* **Malicious Payload**:
```json
{
  "name": "Arroz Especial",
  "sku": "ARR-002",
  "stock": 100,
  "price_unit": 10.00,
  "tags": ["huge_tag_1", "huge_tag_2", "... 5000 more elements ..."]
}
```
* **Expected Result**: **PERMISSION_DENIED** (List size controls restrict array fields to `size() <= 10`).

### Attack 6: Field Injection (Shadow Keys)
* **Vector**: Attackers send a valid product record but silently inject a system configuration field to overwrite system internals.
* **Malicious Payload**:
```json
{
  "name": "Aceite Vegetal",
  "sku": "ACE-999",
  "stock": 50,
  "price_unit": 4.50,
  "price_cost": 3.00,
  "unapproved_flag": "grant_full_unlocked_terminal_v2"
}
```
* **Expected Result**: **PERMISSION_DENIED** (Keys verification on document creation forces strict map-key alignment: `data.keys().hasAll(...) && data.keys().size() == N`).

### Attack 7: Orphaned Child Document Injection (No Parent)
* **Vector**: Create a detail sale item without a corresponding, verified parent sale transaction record.
* **Malicious Payload**:
```json
{
  "sale_id": "NON_EXISTENT_INVALID_ID",
  "product_id": "PROD-201",
  "quantity": 5,
  "price": 12.00
}
```
* **Expected Result**: **PERMISSION_DENIED** (`existsAfter()` or parent `exists()` verification forces that the parent transaction index must actually be recorded on Firestore).

### Attack 8: Unauthenticated System Settings Overwrite
* **Vector**: An anomalous unauthenticated requests attempts to modify the active exchange rate settings.
* **Malicious Payload**:
```json
{
  "key": "exchange_rate",
  "value": "1500.00"
}
```
* **Expected Result**: **PERMISSION_DENIED** (Only verified admins whose profile document evaluates to `role == 'admin'` can alter Settings).

### Attack 9: Bypass of Verifications Claims
* **Vector**: Attempting to perform write operations while authenticated but having unverified email status.
* **Malicious Profile auth**:
```json
{
  "uid": "user_hash",
  "email": "malicious@domain.com",
  "email_verified": false
}
```
* **Expected Result**: **PERMISSION_DENIED** (Mandatory verification requires `request.auth.token.email_verified == true`).

### Attack 10: Cash Closure Override (Terminal state hack)
* **Vector**: Cashier attempts to update or alter a cash register closing balance summary document post-execution.
* **Malicious Payload**:
```json
{
  "amount": 54000.00,
  "observation": "Overwritten by unauthorized terminal call post-signing."
}
```
* **Expected Result**: **PERMISSION_DENIED** (Caja Cierres are strictly immutable once signed, and can only be deleted/cleared in emergency states by an authentic administrative credential).

### Attack 11: PII Leak via Blanket Reads
* **Vector**: A basic user attempts to query and list a collection containing confidential worker profiles, addresses or private identifiers.
* **Client Query**:
```tc
db.collection('users').get()
```
* **Expected Result**: **PERMISSION_DENIED** (The `allow list` rules prevent raw iteration, forcing strict client parameters or admin-only permissions).

### Attack 12: Value Type Poisoning
* **Vector**: A client attempts to update a valid field like `price_unit` using a string representation or NaN block to break server-side calculation routes.
* **Malicious Payload**:
```json
{
  "price_unit": "NINETY_THOUSAND_DOLLARS",
}
```
* **Expected Result**: **PERMISSION_DENIED** (`price_unit is number` datatype enforcement prevents calculation injection).

---

## 3. Test Assertion Runner Outline
The full behavior can be validated using a typescript-based Firebase Emulator runner:

```typescript
import { 
  initializeTestEnvironment, 
  RulesTestEnvironment 
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'gtr-pos-security-audit',
    firestore: {
      rules: require('fs').readFileSync('firestore.rules', 'utf8')
    }
  });
});

test('Self-Privilege escalation fails mathematically', async () => {
  const aliceDb = testEnv.authenticatedContext('cashier_john', { 
    email_verified: true 
  }).firestore();
  
  await assertFails(
    setDoc(doc(aliceDb, 'users', 'cashier_john'), {
      username: 'john',
      role: 'admin'
    })
  );
});
```
