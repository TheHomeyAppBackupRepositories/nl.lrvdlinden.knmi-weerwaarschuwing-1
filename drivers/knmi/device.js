const Homey = require('homey');
//const { HomeyAPI } = require('homey-api');
const Parser = require('rss-parser');
const fetch = require('node-fetch');

class knmiDevice extends Homey.Device {
    async onInit() {
        this.log(`[onInit] ${this.homey.manifest.id} - ${this.homey.manifest.version} started...`);
      //  this.homeyApi = await HomeyAPI.createAppAPI({
      //      homey: this.homey,
      //    });
        
          // Controleer of this.homeyApi gedefinieerd is
     //     if(this.homeyApi){
     //       this.deviceManager = this.homeyApi.devices;
     //     } else {
      //      this.log('homeyApi is undefined!');
      //    }
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

    async triggerNewArticleTrigger(data) {
        try {
            const notificationText = `${data.title}`;

            await this.homey.notifications.createNotification({
                excerpt: notificationText
            });

            this.log(`[triggerNewArticleTrigger] - Notification sent: ${notificationText}`);
        } catch (error) {
            this.error('[triggerNewArticleTrigger] - Error sending notification', error);
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

                if (pubDate !== this.lastTriggeredPubDate) {
                    this.log(`[checkRssFeed] - New article detected. Triggering new_article flow...`);
                    await this.triggerNewArticle.trigger(this, data)
                        .then(() => {
                            this.log(`[checkRssFeed] - new_article flow triggered successfully.`);
                            this.triggerNewArticleTrigger(data);  // Trigger the notification
                        })
                        .catch((err) => this.error('[checkRssFeed] - Error in triggerNewArticle', err));

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

module.exports = knmiDevice;
