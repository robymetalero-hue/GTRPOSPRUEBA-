const fetch = require('node-fetch');
async function run() {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'roby', password: '123' }) // We don't know the password but we want to see the error
  });
  const text = await res.text();
  console.log(res.status, text.substring(0, 100));
}
run();
