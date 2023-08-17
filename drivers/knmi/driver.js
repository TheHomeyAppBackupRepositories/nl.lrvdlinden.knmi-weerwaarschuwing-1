'use strict';

const { Driver } = require('homey');

const crypto = require('crypto');

class knmiDriver extends Driver {

	async onInit() {
		this.log('KNMI driver has been initialized');
	}

	async onPairListDevices() {
		const id = crypto.randomUUID();
		return [
			{
				name: `KNMI Weer Alarm-${id}`,
				data: {
					id,
				},
			},
		];
	}

}

module.exports = knmiDriver;

