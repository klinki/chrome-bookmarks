const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Read the SVG content
    const svgContent = fs.readFileSync(path.join(__dirname, '../src/icons/icon.svg'), 'utf8');
    
    const sizes = [16, 48, 128];
    
    for (const size of sizes) {
        // Set the viewport to the desired size
        await page.setViewportSize({ width: size, height: size });
        
        // Load the SVG directly into the page
        await page.setContent(`
            <html>
                <body style="margin: 0; padding: 0; overflow: hidden; background: transparent;">
                    ${svgContent.replace('width="64"', `width="${size}"`).replace('height="64"', `height="${size}"`)}
                </body>
            </html>
        `);
        
        // Take a screenshot
        await page.screenshot({ 
            path: path.join(__dirname, `../src/icons/icon-${size}.png`),
            omitBackground: true
        });
        
        console.log(`Generated icon-${size}.png`);
    }
    
    await browser.close();
})();
