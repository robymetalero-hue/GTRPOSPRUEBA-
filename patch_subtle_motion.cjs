const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldMotion = `<motion.div
                            key={view}
                            initial={{ opacity: 0, scale: 0.96, filter: 'blur(10px)', y: 20 }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
                            exit={{ opacity: 0, scale: 1.02, filter: 'blur(5px)', y: -15 }}
                            transition={{ duration: 0.5, ease: [0.19, 1.0, 0.22, 1.0] }}
                            className="h-full w-full overflow-hidden origin-top"
                        >`;

const newMotion = `<motion.div
                            key={view}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="h-full w-full overflow-hidden"
                        >`;

if (code.includes(oldMotion)) {
    code = code.replace(oldMotion, newMotion);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Subtle motion applied successfully!");
} else {
    console.log("Target motion div not found. Searching for alternative matches.");
}
