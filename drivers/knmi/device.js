'use strict';
const Homey = require('homey');
const Parser = require('rss-parser');
const fetch = require('node-fetch');

class knmiDevice extends Homey.Device {
    log() {
        console.log.bind(this, '[log]').apply(this, arguments);
    }

    error() {
        console.error.bind(this, '[error]').apply(this, arguments);
    }

    onInit() {
        this.log(`[onInit] ${this.homey.manifest.id} - ${this.homey.manifest.version} started...`);

        this.triggerNewArticle = this.homey.flow.getDeviceTriggerCard('new_article');

        this.receivedArticleLink = null;

        this.checkInterval = 5 * 60 * 1000; // 5 minutes
        this.parser = new Parser();
        this.feedUrl = 'https://www.knmi.nl/rssfeeds/rss_KNMIwaarschuwingen';

        setInterval(async () => {
            this.checkRssFeed();
        }, this.checkInterval);

        this.checkRssFeed();
    }

    async setImage(imagePath = null) {
        try {
            if (!this._image) {
                this._imageSet = false;
                this._image = await this.homey.images.createImage();

                this.log(`[setImage] - Registering Device image`);
            }

            await this._image.setStream(async (stream) => {
                this.homey.app.log(`[setImage] - Setting image - `, imagePath);

                let res = await fetch(imagePath);
                return res.body.pipe(stream);
            });

            return Promise.resolve(true);
        } catch (e) {
            this.homey.app.error(e);
            return Promise.reject(e);
        }
    }

    async checkRssFeed() {
        try {
            const feed = await this.parser.parseURL(this.feedUrl);

            if (feed && feed.items && feed.items.length) {
                let [latestItem] = feed.items;

                if (latestItem.title && (latestItem.title.includes('RTL Nieuws') || latestItem.title.includes('RTL Weer'))) {
                    this.log(`[checkRssFeed] - skip latestItem due to containing RTL in title:`, latestItem.title);
                    [, latestItem] = feed.items;
                }

                this.log(`[checkRssFeed] - got latestItem:`, latestItem);
                const { title, link, content, pubDate, enclosure } = latestItem;
                const imageUrl = enclosure.url || '';

                await this.setImage(imageUrl);

                const data = {
                    title,
                    link,
                    content,
                    pubDate,
                    imageUrl,
                    image: this._image
                };

                this.lastArticle = data;

                this.log(`[checkRssFeed] - New article data:`, data);

                // Check if the new article has a different pubDate from the last triggered article
                if (pubDate !== this.lastTriggeredPubDate) {
                    this.log(`[checkRssFeed] - New article detected. Triggering new_article flow...`);
                   await this.triggerNewArticle.trigger(this,data)
                        .then(() => {
                            this.log(`[checkRssFeed] - new_article flow triggered successfully.`);
                        })
                        .catch((err) => this.error('[checkRssFeed] - Error in triggerNewArticle', err));

                    // Update the lastTriggeredPubDate with the current pubDate
                    this.lastTriggeredPubDate = pubDate;
                } else {
                    this.log(`[checkRssFeed] - Article already triggered, skipping...`);
                }
            }

        } catch (err) {
            this.error(`[checkRssFeed] - Error in retrieving RSS-feed:`, err);
        }
    }
}

class knmiApp extends Homey.App {
    onInit() {
        this.log('[knmiApp] initialized...');

        // Register triggers
        const newArticleTrigger = new Homey.FlowCardTriggerDevice('new_article');
        newArticleTrigger
            .register()
            .registerRunListener(async (args, state) => {
                // No need to use the settings here, the trigger will directly pass the values to the condition cards
                return true;
            });

        // Register conditions code

            const code = this.homey.flow.getConditionCard('code');
            code.registerRunListener(async (args, state) => {
                this.homey.app.log('[code]', state, { ...args, device: 'LOG' });
                return true;
            });

        // Register conditions code

        const codeCondition = this.homey.flow.getConditionCard('code');
        codeCondition.registerRunListener(async (args, state) => {
          this.homey.app.log('[code_dropdown]', state, { ...args, device: 'LOG' });
          return this.lastArticle && this.lastArticle.title && this.lastArticle.title.includes(args.dropdown_code)
        });

        // Register conditions provincie

        const ProvincesCondition = this.homey.flow.getConditionCard('Provinces');
        ProvincesCondition.registerRunListener(async (args, state) => {
          this.homey.app.log('[dropdown_province]', state, { ...args, device: 'LOG' });
          return this.lastArticle && this.lastArticle.title && this.lastArticle.title.includes(args.dropdown_province)
        });

        // Register conditions multi code
        const multiple_codeCondition = this.homey.flow.getConditionCard('multiple_code');
        multiple_codeCondition.registerRunListener(async (args, state) => {
          this.homey.app.log('[dropdown_code_1]', state, { ...args, device: 'LOG' });
          this.homey.app.log('[dropdown_code_2]', this.lastArticle);

          const code1 = this.lastArticle && this.lastArticle.title && this.lastArticle.title.includes(args.dropdown_code_1)
          const code2 = this.lastArticle && this.lastArticle.title && this.lastArticle.title.includes(args.dropdown_code_2)
          return code1 || code2;
        });

        // Register conditions multi provincie
        const multiple_provinceCondition = this.homey.flow.getConditionCard('multiple_provinces');
        multiple_provinceCondition.registerRunListener(async (args, state) => {
          this.homey.app.log('[dropdown_province_1]', state, { ...args, device: 'LOG' });
          this.homey.app.log('[dropdown_province_2]', this.lastArticle);

          const province1 = this.lastArticle && this.lastArticle.title && this.lastArticle.title.includes(args.dropdown_province_1)
          const province2 = this.lastArticle && this.lastArticle.title && this.lastArticle.title.includes(args.dropdown_province_2)
          return province1 || province2;
        });


    }
}

module.exports = knmiDevice;

