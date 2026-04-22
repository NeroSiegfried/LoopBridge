/**
 * LoopBridge — Services barrel export
 */
'use strict';

module.exports = {
    authService:          require('./authService'),
    articleService:       require('./articleService'),
    courseService:        require('./courseService'),
    paymentService:       require('./paymentService'),
    storageService:       require('./storageService'),
    notificationService:  require('./notificationService'),
    categorizationService: require('./categorizationService'),
    recommendationService: require('./recommendationService'),
    transcodingService:   require('./transcodingService'),
};
