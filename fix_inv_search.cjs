const fs = require('fs');

const invFile = 'src/views/Inventory.tsx';
let content = fs.readFileSync(invFile, 'utf8');

const replacement = `
// --- Optimized Search Input ---
const InventorySearchInput = React.memo(({ onSearchChange, onEnter, initialValue, isSearching }: { onSearchChange: (val: string) => void, onEnter: (val: string) => void, initialValue: string, isSearching: boolean }) => {
    const [localVal, setLocalVal] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync with external clear
    useEffect(() => {
        if (initialValue === "") {
            setLocalVal("");
            if (inputRef.current) inputRef.current.value = "";
        }
    }, [initialValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalVal(val);
        onSearchChange(val);
    };

    const handleClear = () => {
        setLocalVal("");
        onSearchChange("");
        if (inputRef.current) {
            inputRef.current.value = "";
            inputRef.current.focus();
        }
    };

    return (
        <div className="relative w-full md:max-w-sm shrink-0">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                {isSearching ? (
                    <Loader2 size={14} className="animate-spin text-blue-500" />
                ) : (
                    <Search size={14} />
                )}
            </span>
            <input 
                ref={inputRef}
                type="text" 
                id="search-query-input"
                placeholder="Buscar artículo por nombre, SKU..." 
                className="pl-9 pr-8 py-2.5 w-full bg-slate-55 dark:bg-black/15 border border-slate-100 dark:border-slate-850 rounded-2xl focus:outline-none focus:border-blue-500 dark:text-white text-xs transition placeholder-slate-400 font-semibold"
                value={localVal}
                onChange={handleChange}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        onEnter(localVal);
                    }
                }}
                autoComplete="off"
                spellCheck="false"
            />
            {localVal && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
});
`;

if (!content.includes('InventorySearchInput')) {
    content = content.replace('export default function Inventory() {', replacement + '\nexport default function Inventory() {');
}

fs.writeFileSync(invFile, content);
