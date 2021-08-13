import {schema} from './src/index.js'

debugger
const promoReportSchema = new schema.Entity('promo', {})
promoReportSchema.define({
    itemsInfo: {
        additionalOffers: [{
            showPlaceId: [new schema.Entity('qwer', {})],
        }],
    },
});
