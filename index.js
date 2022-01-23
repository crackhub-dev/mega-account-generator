const MailClient = require('mail.tm');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const faker = require('@faker-js/faker');
const fsExtra = require('fs-extra');

const mail = new MailClient;
const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"'
];

async function generateDetails() {
    let details = await mail.generateAccount();
    let email = details.data.username;
    let emailPassword = details.data.password;
    let password = faker.internet.password();
    console.log('Generated Credentials');
    return {
        email,
        password,
        emailPassword
    }
}
generateDetails().then(details => {
    async function register() {
        const firstName = faker.name.firstName();
        const lastName = faker.name.lastName();
        const browser = await puppeteer.launch({
            headless: true,
            ignoreHTTPSErrors: true,
            userDataDir: './tmp',
            args: args,
            ignoreDefaultArgs: ['--enable-automation']
        });
        const page = await browser.newPage();
        await page.goto("https://mega.nz/register");
        console.log("Registering...");
        await page.waitForSelector('#register_form');
        await page.type('#register-firstname-registerpage2', firstName);
        await page.type('#register-lastname-registerpage2', lastName);
        await page.type('#register-email-registerpage2', details.email);
        await page.type('#register-password-registerpage2', details.password);
        await page.type('#register-password-registerpage3', details.password);
        await page.click('#register-check-registerpage2');
        await page.$$eval('.understand-check', (elements) => {
            elements[0].click();
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.click('.register-button');
        await mail.login(details.email, details.emailPassword);
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log("Verifying account...");
        let confirmEmailId = await mail.fetchMessages();
        let message = await mail.fetchMessage(confirmEmailId.data[0].id);
        let exp = /(https?:\/\/[^ ]*)/;
        let confirmLink = message.data.text.match(exp)[0].replace('Best', '');
        await page.goto(confirmLink);
        await page.waitForSelector('#login-password2');
        await page.type('#login-password2', details.password);
        await page.click('.login-button');
        await browser.close();
        fs.writeFileSync(path.join(__dirname, 'details.json'), JSON.stringify(details));
        console.log('Successfully registered and verified account! Wrote details to details.json.');
        console.log("You can login to the email account on https://mail.tm with the provided 'emailPassword' and email.\n")
        console.log(`Your Mega Login Credentials: \n E-mail: ${details.email} \n Password: ${details.password}`);
        fsExtra.emptyDirSync('./tmp');
    }
    register();
})