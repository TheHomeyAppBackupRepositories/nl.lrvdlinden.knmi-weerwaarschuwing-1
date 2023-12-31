'use strict';

const Homey = require('homey');
//const { HomeyAPI } = require('homey-api');
class homeyknmi extends Homey.App {
    
    async onInit() {
        this.log('KNMI Weerwaarschuwing is being initialized');
		//try {
		//	this.homeyApi = await HomeyAPI.createAppAPI({ homey: this.homey });
		//	this.deviceManager = this.homeyApi.devices;
		  } catch (error) {
			this.log('Error creating Homey API:', error);
			
        process.on('uncaughtException', (err) => {
			this.error(`UnCaught exception: ${err}\n`);
		});

		process.on('unhandledRejection', (reason, p) => {
			this.error('Unhandled Rejection at:', p, 'reason:', reason);
		});

		this.homey
		.on('unload', () => {
			this.log('app unload called');
		})
		.on('memwarn', () => {
			this.log('memwarn!');
		})
		.on('cpuwarn', () => {
			this.log('cpu warning');
		});

		  }
    }

//}

// module.exports.init = homeyknmi;
module.exports = homeyknmi;