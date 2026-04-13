/**
 * LoopBridge — Repositories barrel export
 */
'use strict';

module.exports = {
    userRepo:       require('./userRepo'),
    sessionRepo:    require('./sessionRepo'),
    articleRepo:    require('./articleRepo'),
    courseRepo:     require('./courseRepo'),
    progressRepo:   require('./progressRepo'),
    uploadRepo:     require('./uploadRepo'),
    faqRepo:        require('./faqRepo'),
    otpRepo:        require('./otpRepo'),
    subscriberRepo: require('./subscriberRepo'),
};
