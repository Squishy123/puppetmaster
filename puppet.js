const events = require('events')
const puppeteer = require('puppeteer')

class Puppet {
    constructor(args) {
        this.flags = args.flags || {};
        //default 5 pages max
        this.numPages = args.numPages || 5;

        //free pages
        this.fPages = [];
        //used pages
        this.uPages = [];

        this.state = null;

        let puppet = this;
        this.emitter = new events.EventEmitter();
        this.emitter.on('init', () => {
            puppet.state = "idle"
            console.log("Puppet Initiated!");
        });

        this.emitter.on('destroy', () => {
            puppet.state = "destroyed"
            console.log("Puppet Destroyed!");
        });

        this.emitter.on('taskStart', () => {
            if (puppet.fPages.length > 1) {
                console.log("Resource Available. Task Started!")
                return true;
            } else {
                console.log("Resources Unavailable. Waiting for resources...")
                return false;
            }
        });

        this.emitter.on('taskComplete', () => {
            console.log("Task Completed!");
        });
    }
    async init() {
        this.browser = await puppeteer.launch(this.flags);
        let pages = [];
        for (let i = 0; i < this.numPages; i++) {
            pages.push((async () => { return await this.browser.newPage() })())
        }
        this.fPages = await Promise.all(pages);
        this.emitter.emit('init')
    }

    async runTask(task) {
        //keep running until a page has been free
        while (!this.emitter.emit('taskStart')) { };

        //move a freed page to used page
        let page = this.fPages.shift();
        this.uPages.push(page);
        await task.call({ page: page });

        this.emitter.emit("taskComplete");
        this.uPages.splice(this.uPages.indexOf(page), 1);
        this.fPages.push(page);
    }

    async destroy() {
        let pages = []
        this.fPages.forEach(page => {
            pages.push((async () => { await page.close() })());
        });
        this.uPages.forEach(page => {
            pages.push((async () => { await page.close() })());
        });
        await Promise.all(pages);
        await this.browser.close();
        this.emitter.emit("destroy")
    }


}

async function test() {
    await this.page.goto("https://stackoverflow.com/questions/8668174/indexof-method-in-an-object-array");
}

(async () => {
    let p = new Puppet({ flags: { headless: false } });
    await p.init();
    for (let i = 0; i < 100; i++) {
        await p.runTask(test)
    }
    await p.destroy();
})()