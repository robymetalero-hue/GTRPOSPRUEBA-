const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(`                        </span>
                    </div>
                    
                </div>
            </div>`, `                        </span>
                    </div>
            </div>`);
fs.writeFileSync('src/App.tsx', code);
