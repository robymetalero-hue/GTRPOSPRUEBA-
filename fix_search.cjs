const fs = require('fs');

const posFile = 'src/views/POS.tsx';
let content = fs.readFileSync(posFile, 'utf8');

const replacement = `
// --- Optimized Search Input ---
const POSSearchInput = React.memo(({ onSearchChange, initialValue, isSearching }: { onSearchChange: (val: string) => void, initialValue: string, isSearching: boolean }) => {
    const [localVal, setLocalVal] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync with external clear (when initialValue becomes empty)
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
        <div className="relative flex-1 min-w-[120px]">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                {isSearching ? (
                    <Loader2 size={13} className="animate-spin text-indigo-500" />
                ) : (
                    <Search size={13} />
                )}
            </span>
            <input 
                ref={inputRef}
                type="text" 
                id="search-input"
                placeholder="Buscar artículo o sku..." 
                className="pl-9 pr-8 py-1.5 w-full bg-slate-50/50 dark:bg-black/10 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white text-[11.5px] transition placeholder-slate-400 font-semibold"
                value={localVal}
                onChange={handleChange}
                autoComplete="off"
                spellCheck="false"
            />
            {localVal && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
});
`;

if (!content.includes('POSSearchInput')) {
    content = content.replace('export default function POS() {', replacement + '\nexport default function POS() {');
}

fs.writeFileSync(posFile, content);
