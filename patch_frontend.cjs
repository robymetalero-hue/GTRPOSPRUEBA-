const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Remove handleUserRoleChange function
code = code.replace(/const handleUserRoleChange = [\s\S]*?    };\n/, '');

// Remove the select element for desktop
code = code.replace(/{\/\* Fast switcher to toggle roles or profiles of trabajadores smoothly inside UI \*\/}[\s\S]*?<\/select>/, '');

// Remove the select element for mobile
code = code.replace(/<select\s+className="bg-transparent text-\[10px\] text-slate-400 hover:text-slate-600 font-bold focus:outline-none cursor-pointer"[\s\S]*?<\/select>/, '');

fs.writeFileSync('src/App.tsx', code);
