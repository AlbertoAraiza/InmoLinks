const fs = require('fs');
const filesToRemoveStyleUrl = [
    'src/app/features/public/property-detail/property-detail.component.ts',
    'src/app/features/dashboard/property-list/property-list.component.ts',
    'src/app/features/dashboard/property-form/property-form.component.ts',
    'src/app/features/auth/login/login.component.ts',
    'src/app/features/auth/complete-profile/complete-profile.component.ts',
    'src/app/app.component.ts'
];

filesToRemoveStyleUrl.forEach(f => {
    try {
        let c = fs.readFileSync(f, 'utf8');
        c = c.replace(/,\s*styleUrl:\s*'.*\.scss'/g, '');
        c = c.replace(/\s*styleUrl:\s*'.*\.scss'/g, '');
        fs.writeFileSync(f, c);
        console.log('Fixed styleUrl in', f);
    } catch (e) {
        console.error('Error on', f, e.message);
    }
});

const htmlFile = 'src/app/features/public/property-detail/property-detail.component.html';
try {
    let c = fs.readFileSync(htmlFile, 'utf8');
    c = c.replace(/property\.features\?\./g, 'property.features.');
    c = c.replace(/property\.location\?\./g, 'property.location.');
    fs.writeFileSync(htmlFile, c);
    console.log('Fixed optional chaining in', htmlFile);
} catch (e) {
    console.error('Error on html', e.message);
}
