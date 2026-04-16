
const fs = require('fs');
const content = fs.readFileSync('src/app/scoreboard/page.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 660; i < 670; i++) {
    console.log(`${i+1}: [${lines[i].replace(/ /g, '.')}]`);
}
