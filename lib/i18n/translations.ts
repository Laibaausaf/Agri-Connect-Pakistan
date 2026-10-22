/**
 * AgriConnect English / Urdu translations.
 *
 * Every piece of UI text that changes with the language toggle lives here so
 * the team can review it in one place.
 *
 * - `en` is shown in English mode, `ur` in Urdu mode. They are never mixed.
 * - `unsure` marks a translation that needs a native speaker's review; the
 *   text explains what to check.
 * - `{name}` placeholders are filled in by the app (numbers, names, dates).
 * - Digits stay Western (0-9) in both languages.
 * - Stored data: crop names come from the database (`Crop.nameUrdu`). Places,
 *   grades, packaging, statuses and other fixed values are translated through
 *   the lists below; anything not listed is shown as stored. People's and
 *   business names, batch/deal numbers and free text that someone typed
 *   (notes, varieties, vehicle types) are always shown as stored.
 */

export type Lang = 'en' | 'ur';

export type Entry = { en: string; ur: string; unsure?: string };

/* -------------------------------------------------------------------------- */
/* UI text                                                                     */
/* -------------------------------------------------------------------------- */

export const UI = {
  /* Browser tab title -------------------------------------------------------- */
  'meta.title': { en: 'AgriConnect - AI-powered Digital Mandi for Pakistan', ur: 'ایگری کنیکٹ - پاکستان کی ڈیجیٹل منڈی' },
  'meta.description': { en: 'Trade crops transparently. From farm to payment.', ur: 'فصل کی شفاف خرید و فروخت، کھیت سے ادائیگی تک۔' },

  /* Header ------------------------------------------------------------------ */
  'header.raast': { en: 'SBP Raast Integrated', ur: 'راست ادائیگی سے منسلک', unsure: 'Raast is the State Bank payment system; check the wording.' },
  'header.bannerLong': {
    en: 'Pakistan Digital Mandi Operating System • Swabi to Islamabad Pilot Network',
    ur: 'پاکستان کا ڈیجیٹل منڈی نظام • صوابی سے اسلام آباد تک تجرباتی نیٹ ورک',
  },
  'header.bannerShort': { en: 'Digital Mandi Pilot', ur: 'ڈیجیٹل منڈی (تجرباتی)' },
  'header.brand': { en: 'AgriConnect', ur: 'ایگری کنیکٹ' },
  'header.workspace': { en: '{role} Workspace', ur: '{role} پینل', unsure: '"Workspace" as پینل; alternative: ڈیش بورڈ.' },
  'header.voiceAi': { en: 'Voice AI', ur: 'بول کر پوچھیں' },
  'header.ai': { en: 'AI', ur: 'اے آئی' },
  'header.myProfile': { en: 'My Profile', ur: 'میری پروفائل' },
  'header.logout': { en: 'Log Out', ur: 'لاگ آؤٹ' },
  'header.notifications': { en: 'Notifications', ur: 'اطلاعات' },
  'header.notificationsCount': { en: 'Notifications ({count})', ur: 'اطلاعات ({count})' },
  'header.markAllRead': { en: 'Mark all read', ur: 'سب پڑھ لیں' },
  'header.noNotifications': { en: 'No notifications yet.', ur: 'ابھی کوئی اطلاع نہیں۔' },
  'header.pilotNetwork': { en: 'Pakistan Pilot Network', ur: 'پاکستان تجرباتی نیٹ ورک' },
  'header.languageLabel': { en: 'Language', ur: 'زبان' },
  // The toggle always names each language in its own script (standard for
  // language switchers), so it is the one place both scripts appear.
  'header.switchToUrdu': { en: 'اردو', ur: 'اردو' },
  'header.switchToEnglish': { en: 'English', ur: 'English' },

  /* Sidebar ----------------------------------------------------------------- */
  'sidebar.aiTitle': { en: 'AgriConnect AI', ur: 'ایگری کنیکٹ اے آئی' },
  'sidebar.live': { en: 'LIVE', ur: 'جاری' },

  /* AI hints in the sidebar (per role) ------------------------------------- */
  'aiHint.FARMER': {
    en: 'Ask “Aaj tamatar ka bhao kya hai?” before you accept an arhti offer.',
    ur: 'آڑھتی کی آفر ماننے سے پہلے پوچھیں: "آج ٹماٹر کا بھاؤ کیا ہے؟"',
  },
  'aiHint.ARHTI': {
    en: 'Ask which lots are worth auctioning today and at what reserve.',
    ur: 'پوچھیں کہ آج کون سے لاٹ نیلام کرنے چاہئیں اور کم از کم کس ریٹ پر۔',
  },
  'aiHint.VENDOR': {
    en: 'Ask for the wholesale margin on your current warehouse stock.',
    ur: 'اپنے گودام کے مال پر تھوک منافع کا حساب پوچھیں۔',
  },
  'aiHint.SHOPKEEPER': {
    en: 'Ask which crop is selling fastest in your locality this week.',
    ur: 'پوچھیں کہ اس ہفتے آپ کے علاقے میں کون سی فصل سب سے زیادہ بک رہی ہے۔',
  },

  /* Common ------------------------------------------------------------------ */
  'common.openToOffers': { en: 'Open to offers', ur: 'قیمت کی بات ہو سکتی ہے' },
  'common.back': { en: 'Back', ur: 'واپس' },
  'common.notYet': { en: 'Not yet confirmed', ur: 'ابھی تصدیق نہیں ہوئی' },
  'common.save': { en: 'Save changes', ur: 'محفوظ کریں' },

  /* Farmer home (/for-you) ------------------------------------------------- */
  'home.greeting': { en: 'Assalam-o-Alaikum', ur: 'السلام علیکم' },
  'home.welcome': { en: 'Welcome, {name}', ur: 'خوش آمدید، {name}' },
  'home.question': { en: 'What would you like to do today?', ur: 'آج کیا کرنا ہے؟' },
  'home.nextStep': { en: 'Your next step', ur: 'اگلا قدم' },
  'home.nextStepHint': { en: 'Choose one option. You can come back here anytime.', ur: 'ایک کام چنیں۔ آپ کسی بھی وقت یہاں واپس آ سکتے ہیں۔' },
  'home.step1.title': { en: 'Add a crop', ur: 'فصل درج کریں' },
  'home.step1.detail': { en: 'List your harvest', ur: 'اپنی کٹی ہوئی فصل لسٹ کریں' },
  'home.step2.title': { en: 'Check offers', ur: 'آفرز دیکھیں' },
  'home.step2.detail': { en: 'Review arhti offers', ur: 'آڑھتیوں کی آفرز دیکھیں' },
  'home.step3.title': { en: 'Track a deal', ur: 'سودا دیکھیں' },
  'home.step3.detail': { en: 'Follow deal progress', ur: 'سودے کی صورتحال دیکھیں' },
  'home.step4.title': { en: 'Payments', ur: 'حساب کتاب' },
  'home.step4.detail': { en: 'See paid and pending money', ur: 'ملی ہوئی اور باقی رقم دیکھیں' },
  'home.myCrops': { en: 'My crops', ur: 'میری فصلیں' },
  'home.aiHelp': { en: 'AI help', ur: 'اے آئی مدد' },
  'home.messages': { en: 'Messages', ur: 'پیغامات' },
  'home.listings': { en: 'Farmers’ listings', ur: 'کسانوں کی فصلیں' },
  'home.listingsHint': { en: 'Browse what others have listed. This page is for viewing, not buying.', ur: 'دیکھیں دوسرے کسانوں نے کیا لسٹ کیا ہے۔ یہ صفحہ صرف دیکھنے کے لیے ہے، خریدنے کے لیے نہیں۔' },
  'home.noListings': { en: 'No other listings yet', ur: 'ابھی کوئی فصل درج نہیں' },
  'home.noListingsHint': { en: 'New listings from other farmers will appear here.', ur: 'دوسرے کسانوں کی نئی فصلیں یہاں نظر آئیں گی۔' },
  'home.noLocation': { en: 'Location not added', ur: 'جگہ درج نہیں' },
  'home.available': { en: 'Available', ur: 'دستیاب' },
  'home.seller': { en: 'Seller', ur: 'کسان' },

  /* My crops (/crops) ------------------------------------------------------- */
  'crops.title': { en: 'My Crops', ur: 'میری فصلیں' },
  'crops.subtitle': {
    en: 'Record what you harvested. You do not choose a mandi here — that is agreed with an arhti when you accept a price.',
    ur: 'جو فصل کاٹی ہے وہ یہاں درج کریں۔ یہاں منڈی نہیں چننی — منڈی آڑھتی کے ساتھ ریٹ طے ہونے پر طے ہوتی ہے۔',
  },
  'crops.add': { en: '+ Add Crop Batch', ur: '+ فصل شامل کریں' },
  'crops.statBatches': { en: 'Batches', ur: 'لاٹ', unsure: 'Batch = لاٹ (a lot of produce). Alternative: کھیپ.' },
  'crops.statHarvested': { en: 'Total harvested', ur: 'کل کٹائی' },
  'crops.statUncommitted': { en: 'Still uncommitted', ur: 'ابھی بیچنے کے لیے باقی' },
  'crops.statCommitted': { en: 'Committed to deals', ur: 'سودوں میں دیا گیا' },
  'crops.emptyTitle': { en: 'No crop batches yet', ur: 'ابھی کوئی فصل درج نہیں' },
  'crops.emptyMessage': {
    en: 'Add your harvest so arhtis in Islamabad, Rawalpindi and Peshawar can offer you a price.',
    ur: 'اپنی فصل درج کریں تاکہ اسلام آباد، راولپنڈی اور پشاور کے آڑھتی آپ کو ریٹ دے سکیں۔',
  },
  'crops.emptyAction': { en: 'Add your first batch', ur: 'پہلی فصل درج کریں' },
  'crops.asking': { en: 'asking', ur: 'مانگی گئی قیمت' },
  'crops.harvested': { en: 'Harvested', ur: 'کٹائی' },
  'crops.uncommitted': { en: 'Uncommitted', ur: 'باقی' },
  'crops.origin': { en: 'Origin', ur: 'کہاں سے' },
  'crops.pendingOffers.one': { en: '1 pending offer', ur: '1 آفر جواب کی منتظر' },
  'crops.pendingOffers.other': { en: '{count} pending offers', ur: '{count} آفرز جواب کی منتظر' },
  'crops.archive': { en: 'Archive', ur: 'ہٹا دیں', unsure: '"Archive" hides the batch; ہٹا دیں = remove from the list.' },

  /* Add crop (/crops/new + wizard) ---------------------------------------- */
  'cropNew.title': { en: 'Add your crop', ur: 'اپنی فصل شامل کریں' },
  'cropNew.subtitle': { en: 'We’ll ask one simple question at a time. You can go back and change anything.', ur: 'ہم ایک وقت میں ایک آسان سوال پوچھیں گے۔ آپ واپس جا کر کچھ بھی بدل سکتے ہیں۔' },
  'wizard.stepOf': { en: 'Step {step} of {total}', ur: 'مرحلہ {step} از {total}' },
  'wizard.complete': { en: '{percent}% complete', ur: '{percent}% مکمل' },
  'wizard.step0.title': { en: 'Which crop did you grow?', ur: 'آپ نے کون سی فصل اگائی؟' },
  'wizard.step0.hint': { en: 'Choose the crop you want to sell.', ur: 'وہ فصل چنیں جو آپ بیچنا چاہتے ہیں۔' },
  'wizard.step1.title': { en: 'How much crop is ready?', ur: 'کتنی فصل تیار ہے؟' },
  'wizard.step1.hint': { en: 'Enter the total amount you have. We use kilograms.', ur: 'کل مقدار لکھیں۔ ہم کلو میں حساب رکھتے ہیں۔' },
  'wizard.step2.title': { en: 'What price would you like?', ur: 'آپ کتنی قیمت چاہتے ہیں؟' },
  'wizard.step2.hint': { en: 'You can accept a suggested reference price or let buyers make offers.', ur: 'آپ تجویز کردہ ریٹ لے سکتے ہیں یا خریداروں کو آفر دینے دیں۔' },
  'wizard.step3.title': { en: 'Add crop pictures', ur: 'فصل کی تصویریں لگائیں' },
  'wizard.step3.hint': { en: 'A clear picture helps buyers understand the quality of your crop.', ur: 'صاف تصویر سے خریدار کو فصل کا معیار سمجھ آتا ہے۔' },
  'wizard.step4.title': { en: 'A few final details', ur: 'آخری چند باتیں' },
  'wizard.step4.hint': { en: 'Tell buyers where the crop is and when it is ready.', ur: 'خریداروں کو بتائیں فصل کہاں ہے اور کب تیار ہوگی۔' },
  'wizard.step5.title': { en: 'Check your crop details', ur: 'اپنی فصل کی تفصیل دیکھ لیں' },
  'wizard.step5.hint': { en: 'Make sure everything looks right before saving.', ur: 'محفوظ کرنے سے پہلے دیکھ لیں کہ سب ٹھیک ہے۔' },
  'wizard.qtyLabel': { en: 'How many kilograms do you have?', ur: 'آپ کے پاس کتنے کلو ہیں؟' },
  'wizard.qtyPlaceholder': { en: 'e.g. 500', ur: 'مثلاً 500' },
  'wizard.qtyHint': { en: 'Example: 500 means five hundred kilograms. You can enter a number only.', ur: 'مثال: 500 کا مطلب پانچ سو کلو۔ صرف عدد لکھیں۔' },
  'wizard.qtyAmount': { en: 'Your crop amount: {amount}', ur: 'آپ کی فصل کی مقدار: {amount}' },
  'wizard.suggested': { en: 'Use suggested reference price', ur: 'تجویز کردہ ریٹ لیں' },
  'wizard.perKg': { en: '{amount} per kg', ur: '{amount} فی کلو' },
  'wizard.suggestedNote': { en: 'From the app’s stored market-price records. This may not be a live quote.', ur: 'یہ ایپ میں محفوظ منڈی ریٹ سے لیا گیا ہے۔ ہو سکتا ہے یہ آج کا تازہ ریٹ نہ ہو۔' },
  'wizard.noSuggested': { en: 'No reference price is available for {crop} right now.', ur: 'ابھی {crop} کا کوئی حوالہ ریٹ موجود نہیں۔' },
  'wizard.thisCrop': { en: 'this crop', ur: 'اس فصل' },
  'wizard.ownPrice': { en: 'I want to set my own price', ur: 'میں اپنی قیمت خود لگاؤں گا' },
  'wizard.ownPriceHint': { en: 'Enter the amount you want for each kilogram.', ur: 'ہر کلو کی جو قیمت چاہتے ہیں وہ لکھیں۔' },
  'wizard.ownPricePlaceholder': { en: 'Rs per kg', ur: 'روپے فی کلو' },
  'wizard.offers': { en: 'Let buyers make me an offer', ur: 'خریدار مجھے آفر دیں' },
  'wizard.offersHint': { en: 'You do not need to decide a price now.', ur: 'ابھی قیمت طے کرنے کی ضرورت نہیں۔' },
  'wizard.photoTitle': { en: 'Take a clear picture of your crop', ur: 'اپنی فصل کی صاف تصویر لیں' },
  'wizard.photoHint': {
    en: 'Put a small amount of crop in good light. Keep the camera steady and make sure the crop is clearly visible. You can take a new picture or choose one from your phone.',
    ur: 'تھوڑی سی فصل اچھی روشنی میں رکھیں۔ کیمرا سیدھا رکھیں اور دیکھیں کہ فصل صاف نظر آئے۔ آپ نئی تصویر لے سکتے ہیں یا فون سے چن سکتے ہیں۔',
  },
  'wizard.uploading': { en: 'Uploading…', ur: 'اپ لوڈ ہو رہی ہے…' },
  'wizard.choosePhotos': { en: 'Take or choose pictures', ur: 'تصویر لیں یا چنیں' },
  'wizard.photoRules': { en: 'PNG, JPG or JPEG · up to 8 MB each · maximum 5 pictures', ur: 'تصویر کی قسم PNG، JPG یا JPEG · ہر ایک 8 MB تک · زیادہ سے زیادہ 5 تصویریں', unsure: 'File type names and "MB" are kept as is (technical).' },
  'wizard.photoAlt': { en: 'Uploaded crop', ur: 'فصل کی تصویر' },
  'wizard.removePhoto': { en: 'Remove picture', ur: 'تصویر ہٹائیں' },
  'wizard.errType': { en: 'Please choose PNG, JPG, or JPEG images only.', ur: 'صرف PNG، JPG یا JPEG تصویر چنیں۔' },
  'wizard.errMax': { en: 'You can add up to 5 pictures.', ur: 'زیادہ سے زیادہ 5 تصویریں لگا سکتے ہیں۔' },
  'wizard.errSize': { en: '{file} is larger than 8 MB. Choose a smaller picture.', ur: '{file} کا سائز 8 MB سے زیادہ ہے۔ چھوٹی تصویر چنیں۔' },
  'wizard.errUpload': { en: 'Could not upload the picture. Please try again.', ur: 'تصویر اپ لوڈ نہیں ہو سکی۔ دوبارہ کوشش کریں۔' },
  'wizard.errUploadFailed': { en: 'Upload failed. Please try again.', ur: 'اپ لوڈ ناکام ہو گیا۔ دوبارہ کوشش کریں۔' },
  'wizard.village': { en: 'Which village are you from? (optional)', ur: 'آپ کس گاؤں سے ہیں؟ (اختیاری)' },
  'wizard.villagePlaceholder': { en: 'Village name', ur: 'گاؤں کا نام' },
  'wizard.city': { en: 'Which city or tehsil is the crop in?', ur: 'فصل کس شہر یا تحصیل میں ہے؟' },
  'wizard.cityPlaceholder': { en: 'City or tehsil', ur: 'شہر یا تحصیل' },
  'wizard.province': { en: 'Which province?', ur: 'کون سا صوبہ؟' },
  'wizard.harvestDate': { en: 'When did you harvest it?', ur: 'فصل کب کاٹی؟' },
  'wizard.readyDate': { en: 'When will it be ready? (optional)', ur: 'کب تیار ہوگی؟ (اختیاری)' },
  'wizard.packaging': { en: 'How is it packed? (optional)', ur: 'کس چیز میں پیک ہے؟ (اختیاری)' },
  'wizard.packagingPlaceholder': { en: 'e.g. sacks or crates', ur: 'مثلاً بوریاں یا کریٹ' },
  'wizard.notes': { en: 'Anything else buyers should know? (optional)', ur: 'خریداروں کو کچھ اور بتانا ہے؟ (اختیاری)' },
  'wizard.notesPlaceholder': { en: 'e.g. freshly harvested, good quality', ur: 'مثلاً تازہ کٹی ہوئی، اچھا معیار' },
  'wizard.yourListing': { en: 'Your crop listing', ur: 'آپ کی فصل کی لسٹنگ' },
  'wizard.rowQuantity': { en: 'Quantity', ur: 'مقدار' },
  'wizard.rowPrice': { en: 'Price', ur: 'قیمت' },
  'wizard.rowPictures': { en: 'Pictures', ur: 'تصویریں' },
  'wizard.rowLocation': { en: 'Location', ur: 'جگہ' },
  'wizard.rowHarvest': { en: 'Harvest date', ur: 'کٹائی کی تاریخ' },
  'wizard.rowReady': { en: 'Ready date', ur: 'تیاری کی تاریخ' },
  'wizard.rowVariety': { en: 'Variety', ur: 'قسم' },
  'wizard.buyersOffer': { en: 'Buyers can make offers', ur: 'خریدار آفر دے سکتے ہیں' },
  'wizard.reference': { en: '{price} (reference)', ur: '{price} (حوالہ ریٹ)' },
  'wizard.picturesAdded': { en: '{count} added', ur: '{count} لگائی گئیں' },
  'wizard.variety': { en: 'Crop variety (optional)', ur: 'فصل کی قسم (اختیاری)' },
  'wizard.varietyPlaceholder': { en: 'e.g. Super Kernel, Desi', ur: 'مثلاً سپر کرنل، دیسی' },
  'wizard.quality': { en: 'Crop quality', ur: 'فصل کا معیار' },
  'wizard.saveNote': {
    en: 'When you save, this crop becomes visible in the farmer product feed and can receive offers from arhtis.',
    ur: 'محفوظ کرنے پر یہ فصل کسانوں کی فصلوں میں نظر آئے گی اور آڑھتی اس پر آفر دے سکیں گے۔',
  },
  'wizard.back': { en: 'Back', ur: 'واپس' },
  'wizard.continue': { en: 'Continue', ur: 'آگے' },
  'wizard.saving': { en: 'Saving your crop…', ur: 'فصل محفوظ ہو رہی ہے…' },
  'wizard.save': { en: 'Save my crop', ur: 'فصل محفوظ کریں' },

  /* Arhti requests (/arhti-requests) -------------------------------------- */
  'offers.title': { en: 'Arhti Requests', ur: 'آڑھتی کی آفرز', unsure: 'The menu item uses the existing آڑھتی کی طلب; this page lists offers, so the title says آفرز. Pick one for both.' },
  'offers.subtitle': { en: 'Review a price, then accept or decline.', ur: 'آفر دیکھیں، پھر منظور یا انکار کریں۔' },
  'offers.waiting': { en: 'Offers waiting for your answer', ur: 'آفرز جن کا جواب دینا ہے' },
  'offers.emptyTitle': { en: 'No offers right now', ur: 'ابھی کوئی آفر نہیں' },
  'offers.emptyMessage': {
    en: 'Once you add a crop batch, arhtis in nearby mandis can send you a rate. You will get a notification.',
    ur: 'فصل درج کرنے کے بعد قریبی منڈیوں کے آڑھتی آپ کو ریٹ بھیج سکتے ہیں۔ آپ کو اطلاع مل جائے گی۔',
  },
  'offers.emptyAction': { en: 'Add a crop batch', ur: 'فصل درج کریں' },
  'offers.bestRate': { en: 'Best rate', ur: 'سب سے اچھا ریٹ' },
  'offers.arhti': { en: 'Arhti', ur: 'آڑھتی' },
  'offers.wants': { en: '{place} • wants {qty} of {batch}', ur: '{place} • {batch} میں سے {qty} چاہیے' },
  'offers.rate': { en: 'Rate', ur: 'ریٹ' },
  'offers.youReceive': { en: 'You receive', ur: 'آپ کو ملیں گے' },
  'offers.destination': { en: 'Destination', ur: 'کہاں جائے گی' },
  'offers.transport': { en: 'Transport', ur: 'گاڑی' },
  'offers.transportArhti': { en: 'Arhti arranges', ur: 'آڑھتی کرے گا' },
  'offers.transportFarmer': { en: 'You arrange', ur: 'آپ کریں گے' },
  'offers.transportShared': { en: 'Shared', ur: 'آدھا آدھا' },
  'offers.accept': { en: 'Accept', ur: 'منظور' },
  'offers.decline': { en: 'Decline', ur: 'انکار' },
  'offers.demandTitle': { en: 'What arhtis need this week', ur: 'اس ہفتے آڑھتیوں کو کیا چاہیے' },
  'offers.noDemand': { en: 'No open buy requests at the moment.', ur: 'ابھی خریداری کی کوئی طلب نہیں۔' },
  'offers.demandWants': { en: 'Wants {min} – {max}', ur: '{min} سے {max} تک چاہیے' },
  'offers.rateRange': { en: '{min} – {max}', ur: '{min} سے {max}' },
  'offers.rateOnDiscussion': { en: 'Rate on discussion', ur: 'ریٹ بات چیت سے' },
  'offers.neededBy': { en: 'Needed by {date}', ur: '{date} تک چاہیے' },
  'offers.arhtiTransport': { en: 'transport arranged by arhti', ur: 'گاڑی آڑھتی کرے گا' },
  'offers.history': { en: 'Offer history', ur: 'پرانی آفرز' },
  'offers.qtyAt': { en: '{qty} at {rate}', ur: '{qty}، {rate}' },
  'offers.viewDeal': { en: 'View deal', ur: 'سودا دیکھیں' },

  /* Deals list (/deals) ---------------------------------------------------- */
  'deals.titleFarmer': { en: 'My Deals', ur: 'میرے سودے' },
  'deals.titleArhti': { en: 'Farmer Deals', ur: 'کسان سودے' },
  'deals.subtitleFarmer': { en: 'See the status of your crop, weighing, delivery and payment here.', ur: 'اپنی فصل، وزن، ترسیل اور ادائیگی کی صورتحال یہاں دیکھیں۔' },
  'deals.subtitleArhti': { en: 'Track purchases from agreement through weighing to payment.', ur: 'سودا طے ہونے سے وزن اور ادائیگی تک خریداری کی صورتحال دیکھیں۔' },
  'deals.emptyTitle': { en: 'No deals yet', ur: 'ابھی کوئی سودا نہیں' },
  'deals.emptyFarmer': { en: 'Accept an arhti offer and the deal will appear here with transport and payment steps.', ur: 'آڑھتی کی آفر منظور کریں، سودا گاڑی اور ادائیگی کے مراحل کے ساتھ یہاں نظر آئے گا۔' },
  'deals.emptyArhti': { en: 'Send a price offer from the Farmer Market and accepted offers will land here.', ur: 'کسان منڈی سے ریٹ کی آفر بھیجیں، منظور شدہ آفرز یہاں آئیں گی۔' },
  'deals.emptyActionFarmer': { en: 'See arhti offers', ur: 'آڑھتی کی آفرز دیکھیں' },
  'deals.emptyActionArhti': { en: 'Open Farmer Market', ur: 'کسان منڈی کھولیں' },
  'deals.inProgress': { en: 'In progress ({count})', ur: 'جاری ({count})' },
  'deals.nothingInProgress': { en: 'Nothing in progress.', ur: 'کوئی سودا جاری نہیں۔' },
  'deals.closed': { en: 'Closed ({count})', ur: 'مکمل ({count})' },
  'deals.arhti': { en: 'Arhti', ur: 'آڑھتی' },
  'deals.farmer': { en: 'Farmer', ur: 'کسان' },
  'deals.quantity': { en: 'Quantity', ur: 'مقدار' },
  'deals.rate': { en: 'Rate per kg', ur: 'فی کلو ریٹ' },
  'deals.youGet': { en: 'You receive', ur: 'آپ کو ملنے ہیں' },
  'deals.destination': { en: 'Destination', ur: 'منزل' },
  'deals.afterWeighing': { en: 'After weighing', ur: 'وزن کے بعد' },

  /* Deal detail (/deals/[id]) --------------------------------------------- */
  'deal.allDeals': { en: 'All deals', ur: 'سب سودے' },
  'deal.agreedRate': { en: 'Agreed rate', ur: 'طے شدہ ریٹ' },
  'deal.agreedQty': { en: 'Agreed quantity', ur: 'طے شدہ مقدار' },
  'deal.weighed': { en: 'Weighed at mandi', ur: 'منڈی میں وزن' },
  'deal.weightDiff': { en: '{diff} vs agreed', ur: 'طے شدہ سے {diff}' },
  'deal.pendingKanta': { en: 'Pending kanta', ur: 'کانٹا ابھی باقی' },
  'deal.netToYou': { en: 'Net payable to you', ur: 'آپ کو ملنے والی رقم' },
  'deal.netToFarmer': { en: 'Net payable to farmer', ur: 'کسان کو دینے والی رقم' },
  'deal.afterWeighing': { en: 'After weighing', ur: 'وزن کے بعد' },
  'deal.batch': { en: 'Batch {batch}', ur: 'لاٹ {batch}' },
  'deal.buyingArhti': { en: 'Buying arhti', ur: 'خریدنے والا آڑھتی' },
  'deal.sellingFarmer': { en: 'Selling farmer', ur: 'بیچنے والا کسان' },
  'deal.contact': { en: 'Contact', ur: 'رابطہ' },
  'deal.destinationMandi': { en: 'Destination mandi', ur: 'منزل منڈی' },
  'deal.transport': { en: 'Transport', ur: 'گاڑی' },
  'deal.transportFarmer': { en: 'Farmer arranges transport', ur: 'گاڑی کسان کرے گا' },
  'deal.transportArhti': { en: 'Arhti arranges transport', ur: 'گاڑی آڑھتی کرے گا' },
  'deal.transportShared': { en: 'Transport cost shared 50/50', ur: 'گاڑی کا خرچ آدھا آدھا' },
  'deal.progress': { en: 'Deal progress', ur: 'سودے کی صورتحال' },
  'deal.stage.agreed': { en: 'Deal agreed', ur: 'سودا طے' },
  'deal.stage.booked': { en: 'Transport booked', ur: 'گاڑی بک' },
  'deal.stage.transit': { en: 'In transit', ur: 'راستے میں' },
  'deal.stage.weighed': { en: 'Weighed at mandi', ur: 'منڈی میں وزن' },
  'deal.stage.paid': { en: 'Farmer paid', ur: 'ادائیگی' },
  'deal.inProgressNow': { en: 'In progress now', ur: 'ابھی جاری' },
  'deal.driver': { en: 'Driver', ur: 'ڈرائیور' },
  'deal.vehicle': { en: 'Vehicle', ur: 'گاڑی' },
  'deal.scheduled': { en: 'Scheduled', ur: 'طے شدہ وقت' },
  'deal.loaded': { en: 'Loaded', ur: 'مال لادا گیا' },
  'deal.freight': { en: 'Freight', ur: 'کرایہ' },
  'deal.deliveryStatus': { en: 'Delivery status', ur: 'ترسیل کی صورتحال' },
  'deal.settlement': { en: 'Settlement (parchee)', ur: 'حساب (پرچی)' },
  'deal.gross': { en: 'Gross — {qty} × {rate}', ur: 'کل رقم — {qty} × {rate}' },
  'deal.netPayable': { en: 'Net payable', ur: 'صاف رقم' },
  'deal.weighedBy': { en: 'Weighed by {name} on {date}', ur: '{date} کو {name} نے وزن کیا' },
  'deal.trace': { en: 'Traceability record', ur: 'فصل کا ریکارڈ' },
  'deal.bookTruck': { en: 'Book the truck', ur: 'گاڑی بک کریں' },
  'deal.noAccountNeeded': { en: '{who}. The driver does not need an AgriConnect account.', ur: '{who}۔ ڈرائیور کو ایگری کنیکٹ اکاؤنٹ کی ضرورت نہیں۔' },
  'deal.saveTransport': { en: 'Save transport', ur: 'گاڑی محفوظ کریں' },
  'deal.transportSaved': { en: 'Transport booked. Confirm loading once the produce is on the truck.', ur: 'گاڑی بک ہو گئی۔ مال گاڑی میں لادنے کے بعد تصدیق کریں۔' },
  'deal.driverName': { en: 'Driver name', ur: 'ڈرائیور کا نام' },
  'deal.driverPhone': { en: 'Driver phone', ur: 'ڈرائیور کا فون' },
  'deal.vehicleType': { en: 'Vehicle type', ur: 'گاڑی کی قسم' },
  'deal.plate': { en: 'Plate', ur: 'گاڑی نمبر' },
  'deal.pickupTime': { en: 'Pickup time', ur: 'اٹھانے کا وقت' },
  'deal.freightCost': { en: 'Freight cost (Rs)', ur: 'کرایہ (روپے)' },
  'deal.freightHint': { en: "Deducted from the farmer's settlement only if the farmer or both parties bear transport.", ur: 'یہ کسان کے حساب سے صرف تب کٹے گا جب گاڑی کا خرچ کسان یا دونوں دیں۔' },
  'deal.notes': { en: 'Notes', ur: 'نوٹ' },
  'deal.placeholderDriver': { en: 'Ilyas Khan', ur: 'الیاس خان' },
  'deal.placeholderVehicle': { en: 'Mazda 16ft', ur: 'مزدا 16 فٹ' },
  'deal.placeholderNotes': { en: 'Load from the link road gate', ur: 'لنک روڈ والے گیٹ سے مال اٹھائیں' },
  'deal.waitingTransport': { en: 'Waiting on transport', ur: 'گاڑی کا انتظار' },
  'deal.waitingTransportText': { en: '{who}, so {name} books the vehicle for this deal.', ur: '{who}، اس لیے اس سودے کی گاڑی {name} بک کریں گے۔' },
  'deal.confirmLoading': { en: 'Confirm loading', ur: 'مال لادنے کی تصدیق' },
  'deal.confirmLoadingText': { en: 'Confirm once {driver} has loaded {qty} and left for {city}.', ur: 'جب {driver} {qty} لاد کر {city} کے لیے روانہ ہو جائے تو تصدیق کریں۔' },
  'deal.produceLoaded': { en: 'Produce is loaded', ur: 'گاڑی روانہ' },
  'deal.markedTransit': { en: 'Marked in transit.', ur: 'مال راستے میں ہے۔' },
  'deal.receive': { en: 'Receive at the mandi', ur: 'منڈی میں مال وصول کریں' },
  'deal.receiveText': { en: "Enter the kanta weight. This creates your inventory lot and generates the farmer's settlement.", ur: 'کانٹے کا وزن لکھیں۔ اس سے آپ کا گودام لاٹ بنے گا اور کسان کا حساب تیار ہوگا۔' },
  'deal.recordWeight': { en: 'Record weight & take ownership', ur: 'وزن درج کریں' },
  'deal.received': { en: 'Received. The lot is now in your mandi inventory.', ur: 'مال وصول ہو گیا۔ لاٹ اب آپ کے گودام میں ہے۔' },
  'deal.weighedQty': { en: 'Weighed quantity (kg)', ur: 'وزن (کلو)' },
  'deal.weighedHint': { en: 'Agreed {agreed}. Cannot exceed {max}.', ur: 'طے شدہ {agreed}۔ {max} سے زیادہ نہیں ہو سکتا۔' },
  'deal.kantaOperator': { en: 'Kanta operator', ur: 'کانٹا آپریٹر' },
  'deal.placeholderOperator': { en: 'Rashid Ali', ur: 'راشد علی' },
  'deal.releasePayment': { en: 'Release payment', ur: 'ادائیگی کریں' },
  'deal.releaseText': { en: '{net} to {name} over RAAST, after {deductions} in deductions.', ur: '{deductions} کٹوتی کے بعد {net} راست کے ذریعے {name} کو۔' },
  'deal.pay': { en: 'Pay {amount}', ur: '{amount} ادا کریں' },
  'deal.paid': { en: 'Paid. A parchee receipt has been issued.', ur: 'ادائیگی ہو گئی۔ پرچی جاری ہو گئی ہے۔' },
  'deal.awaitingPayment': { en: 'Awaiting payment', ur: 'ادائیگی کا انتظار' },
  'deal.awaitingPaymentText': { en: '{name} has your produce and owes {amount}.', ur: 'آپ کا مال {name} کے پاس ہے اور انہیں {amount} دینے ہیں۔' },
  'deal.settledAmount': { en: 'the settled amount', ur: 'طے شدہ رقم' },
  'deal.complete': { en: 'Deal complete', ur: 'سودا مکمل' },
  'deal.completeFarmer': { en: 'Payment received. The parchee is in your records.', ur: 'ادائیگی مل گئی۔ پرچی آپ کے حساب کتاب میں ہے۔' },
  'deal.completeArhti': { en: 'Farmer paid. Lot {lot} is in your mandi inventory.', ur: 'کسان کو ادائیگی ہو گئی۔ لاٹ {lot} آپ کے گودام میں ہے۔' },
  'deal.openRecords': { en: 'Open my records', ur: 'میرا حساب کتاب کھولیں' },
  'deal.openInventory': { en: 'Open mandi inventory', ur: 'گودام کھولیں' },

  /* Payments & records (/records) ----------------------------------------- */
  'records.title': { en: 'Payments & Records', ur: 'ادائیگی اور پرچی' },
  'records.subtitle': { en: 'See how much you received and what is still due.', ur: 'کتنی رقم ملی اور کتنی باقی ہے، یہاں دیکھیں۔' },
  'records.received': { en: 'Received', ur: 'ملی ہوئی رقم' },
  'records.awaiting': { en: 'Awaiting payment', ur: 'باقی رقم' },
  'records.emptyTitle': { en: 'No settlements yet', ur: 'ابھی کوئی حساب نہیں' },
  'records.emptyMessage': { en: 'After an arhti weighs your produce at the mandi, the settlement and parchee appear here.', ur: 'منڈی میں آڑھتی کے وزن کرنے کے بعد حساب اور پرچی یہاں نظر آئے گی۔' },
  'records.emptyAction': { en: 'See my deals', ur: 'میرے سودے دیکھیں' },
  'records.paid': { en: 'Paid', ur: 'ادا ہو گیا' },
  'records.awaitingBadge': { en: 'Awaiting payment', ur: 'ادائیگی باقی' },
  'records.line': { en: '{qty} at {rate} to {name} · {city}', ur: '{qty}، {rate} — {name} · {city}' },
  'records.netPayable': { en: 'Net payable', ur: 'صاف رقم' },
  'records.breakdown': { en: 'View payment breakdown', ur: 'تفصیل دیکھیں' },
  'records.gross': { en: 'Gross', ur: 'کل رقم' },
  'records.net': { en: 'Net', ur: 'صاف رقم' },
  'records.openDeal': { en: 'Open deal', ur: 'سودا کھولیں' },
  'records.parcheeIssued': { en: 'Parchee issued {date}', ur: 'پرچی جاری: {date}' },

  /* Messages (/messages, /messages/[id]) ---------------------------------- */
  'messages.back': { en: 'Back to dashboard', ur: 'ڈیش بورڈ پر واپس' },
  'messages.title': { en: 'Messages', ur: 'پیغامات' },
  'messages.count': { en: '{count} conversations', ur: '{count} گفتگو' },
  'messages.empty': { en: 'No messages yet. Start a conversation from an order or lot page.', ur: 'ابھی کوئی پیغام نہیں۔ کسی آرڈر یا لاٹ کے صفحے سے بات شروع کریں۔' },
  'messages.noMessages': { en: 'No messages yet', ur: 'ابھی کوئی پیغام نہیں' },
  'conversation.empty': { en: 'No messages yet. Send the first message below.', ur: 'ابھی کوئی پیغام نہیں۔ نیچے پہلا پیغام بھیجیں۔' },
  'conversation.placeholder': { en: 'Type a message...', ur: 'پیغام لکھیں...' },
  'conversation.send': { en: 'Send', ur: 'بھیجیں' },

  /* Profile (/profile) ----------------------------------------------------- */
  'profile.title': { en: 'Profile', ur: 'پروفائل' },
  'profile.blurb.FARMER': { en: 'You produce and sell to arhtis. Your village and farm details help arhtis judge your consignments.', ur: 'آپ فصل اگاتے ہیں اور آڑھتیوں کو بیچتے ہیں۔ آپ کے گاؤں اور زمین کی تفصیل سے آڑھتی آپ کے مال کا اندازہ لگاتے ہیں۔' },
  'profile.blurb.ARHTI': { en: 'You buy from farmers and auction in the mandi. Your firm name and licence appear on every offer you make.', ur: 'آپ کسانوں سے خریدتے ہیں اور منڈی میں نیلام کرتے ہیں۔ آپ کی فرم کا نام اور لائسنس ہر آفر پر نظر آتا ہے۔' },
  'profile.blurb.VENDOR': { en: 'You win mandi lots and supply shopkeepers. Your warehouse city decides which shopkeepers can buy from you.', ur: 'آپ منڈی کے لاٹ خریدتے ہیں اور دکانداروں کو مال دیتے ہیں۔ آپ کے گودام کے شہر سے طے ہوتا ہے کون سے دکاندار آپ سے خرید سکتے ہیں۔' },
  'profile.blurb.SHOPKEEPER': { en: 'You buy wholesale and sell retail. Your shop name, hours and delivery radius are what customers see.', ur: 'آپ تھوک میں خریدتے ہیں اور پرچون میں بیچتے ہیں۔ گاہک آپ کی دکان کا نام، اوقات اور ڈیلیوری کا علاقہ دیکھتے ہیں۔' },
  'profile.blurb.CONSUMER': { en: 'You buy from nearby shops. Your address and city decide which shops can deliver to you.', ur: 'آپ قریبی دکانوں سے خریدتے ہیں۔ آپ کے پتے اور شہر سے طے ہوتا ہے کون سی دکانیں آپ تک پہنچا سکتی ہیں۔' },
  'profile.blurb.ADMIN': { en: 'You oversee the whole network. Admin accounts have no trading profile.', ur: 'آپ پورے نیٹ ورک کی نگرانی کرتے ہیں۔ ایڈمن اکاؤنٹ کا کوئی تجارتی پروفائل نہیں ہوتا۔' },
  'profile.memberSince': { en: 'Member since {date}', ur: '{date} سے رکن' },
  'profile.tradesAt': { en: 'trades at {mandi}', ur: '{mandi} میں کاروبار' },
  'profile.rating': { en: 'Rating', ur: 'ریٹنگ' },
  'profile.reviews': { en: '{count} reviews', ur: '{count} آراء' },
  'profile.noReviews': { en: 'No reviews yet', ur: 'ابھی کوئی رائے نہیں' },
  'profile.accountRole': { en: 'Account role', ur: 'اکاؤنٹ کی قسم' },
  'profile.oneRole': { en: 'One role per account', ur: 'ہر اکاؤنٹ کا ایک ہی کردار' },
  'profile.status': { en: 'Status', ur: 'حیثیت' },
  'profile.statusHint': { en: 'Set by the mandi admin', ur: 'منڈی ایڈمن طے کرتا ہے' },
  'profile.edit': { en: 'Edit your details', ur: 'اپنی تفصیل بدلیں' },
  'profile.updated': { en: 'Profile updated.', ur: 'پروفائل محفوظ ہو گئی۔' },
  'profile.fullName': { en: 'Full name', ur: 'پورا نام' },
  'profile.phone': { en: 'Phone', ur: 'فون' },
  'profile.location': { en: 'Location', ur: 'جگہ' },
  'profile.farmName': { en: 'Farm or business name', ur: 'فارم یا کاروبار کا نام' },
  'profile.village': { en: 'Village', ur: 'گاؤں' },
  'profile.farmArea': { en: 'Farm area (acres)', ur: 'زمین (ایکڑ)' },
  'profile.firmName': { en: 'Firm name', ur: 'فرم کا نام' },
  'profile.licence': { en: 'Mandi licence number', ur: 'منڈی لائسنس نمبر' },
  'profile.commission': { en: 'Commission rate {rate}% — set by the admin', ur: 'کمیشن ریٹ {rate}% — ایڈمن طے کرتا ہے' },
  'profile.businessName': { en: 'Business name', ur: 'کاروبار کا نام' },
  'profile.warehouseCity': { en: 'Warehouse city', ur: 'گودام کا شہر' },
  'profile.minOrder': { en: 'Minimum order (kg)', ur: 'کم از کم آرڈر (کلو)' },
  'profile.warehouseAddress': { en: 'Warehouse address', ur: 'گودام کا پتہ' },
  'profile.shopName': { en: 'Shop name', ur: 'دکان کا نام' },
  'profile.shopAddress': { en: 'Shop address', ur: 'دکان کا پتہ' },
  'profile.city': { en: 'City', ur: 'شہر' },
  'profile.opens': { en: 'Opens', ur: 'کھلنے کا وقت' },
  'profile.closes': { en: 'Closes', ur: 'بند ہونے کا وقت' },
  'profile.radius': { en: 'Delivery radius (km)', ur: 'ڈیلیوری کا فاصلہ (کلومیٹر)' },
  'profile.radiusHint': { en: 'Customers outside this radius will not see your shop as deliverable', ur: 'اس فاصلے سے باہر کے گاہکوں کو آپ کی دکان ڈیلیوری کے لیے نظر نہیں آئے گی' },
  'profile.deliveryAddress': { en: 'Delivery address', ur: 'ڈیلیوری کا پتہ' },
  'profile.householdSize': { en: 'Household size', ur: 'گھر کے افراد' },
  'profile.othersSay': { en: 'What others say about you', ur: 'دوسرے آپ کے بارے میں کیا کہتے ہیں' },

  /* AI chat (UI around the replies; replies themselves are not translated) */
  'chat.title': { en: 'AgriConnect AI', ur: 'ایگری کنیکٹ اے آئی' },
  'chat.languages': { en: 'English · Urdu · Roman Urdu', ur: 'انگریزی · اردو · رومن اردو' },
  'chat.welcome': {
    en: 'As-salamu alaykum {name}! I am AgriConnect AI, set up for your {role} work. You can type or speak in English, Urdu, or Roman Urdu.',
    ur: 'السلام علیکم {name}! میں ایگری کنیکٹ اے آئی ہوں، آپ کے {role} کے کام کے لیے۔ آپ انگریزی، اردو یا رومن اردو میں لکھ یا بول سکتے ہیں۔',
  },
  'chat.pendingActions': { en: 'Pending Actions', ur: 'منظوری کے منتظر کام' },
  'chat.confirm': { en: 'Confirm', ur: 'منظور کریں' },
  'chat.cancel': { en: 'Cancel', ur: 'منسوخ کریں' },
  'chat.thinking': { en: 'AgriConnect AI is thinking...', ur: 'ایگری کنیکٹ اے آئی سوچ رہا ہے...' },
  'chat.listeningUrdu': { en: 'Listening... Urdu mein bolain', ur: 'سن رہا ہے... اردو میں بولیں' },
  'chat.listeningEnglish': { en: 'Listening... Speak in English', ur: 'سن رہا ہے... انگریزی میں بولیں' },
  'chat.voiceHint': { en: 'Speak in Urdu or English · Roman Urdu can be typed', ur: 'اردو یا انگریزی میں بولیں · رومن اردو لکھ سکتے ہیں' },
  'chat.voiceUrdu': { en: 'Urdu', ur: 'اردو' },
  'chat.voiceEnglish': { en: 'English', ur: 'انگریزی' },
  'chat.placeholder': { en: 'Ask in English, Urdu, or Roman Urdu...', ur: 'انگریزی، اردو یا رومن اردو میں پوچھیں...' },
  'chat.send': { en: 'Send message', ur: 'پیغام بھیجیں' },
  'chat.micUnsupportedTitle': { en: 'Voice input is not supported by this browser', ur: 'یہ براؤزر آواز سے لکھنا سپورٹ نہیں کرتا' },
  'chat.micStop': { en: 'Stop listening', ur: 'سننا بند کریں' },
  'chat.micUrdu': { en: 'Urdu voice input', ur: 'اردو میں بولیں' },
  'chat.micEnglish': { en: 'English voice input', ur: 'انگریزی میں بولیں' },
  'chat.micStartAria': { en: 'Start voice recognition', ur: 'آواز سے لکھنا شروع کریں' },
  'chat.micStopAria': { en: 'Stop voice recognition', ur: 'آواز سے لکھنا بند کریں' },
  'chat.voiceUnavailable': { en: 'Voice recognition is unavailable in this browser. Use Chrome or Microsoft Edge, or continue by typing.', ur: 'اس براؤزر میں آواز سے لکھنا دستیاب نہیں۔ کروم یا مائیکروسافٹ ایج استعمال کریں، یا لکھ کر جاری رکھیں۔' },
  'chat.errVoiceUnsupported': { en: 'Voice input is not supported in this browser. Please use Chrome or Microsoft Edge, or type your message.', ur: 'اس براؤزر میں آواز سے لکھنا ممکن نہیں۔ کروم یا مائیکروسافٹ ایج استعمال کریں، یا پیغام لکھ دیں۔' },
  'chat.errMicBlocked': { en: 'Microphone access is blocked. Allow microphone permission for this website and try again.', ur: 'مائیک کی اجازت بند ہے۔ اس ویب سائٹ کو مائیک کی اجازت دیں اور دوبارہ کوشش کریں۔' },
  'chat.errNoSpeechUrdu': { en: 'Awaaz samajh nahi aayi. Dobara microphone press karke bolain.', ur: 'آواز سمجھ نہیں آئی۔ دوبارہ مائیک دبا کر بولیں۔' },
  'chat.errNoSpeechEnglish': { en: 'I could not hear anything. Press the microphone and try again.', ur: 'کچھ سنائی نہیں دیا۔ مائیک دبا کر دوبارہ کوشش کریں۔' },
  'chat.errNoMic': { en: 'No microphone was detected. Check your microphone and browser permissions.', ur: 'کوئی مائیک نہیں ملا۔ اپنا مائیک اور براؤزر کی اجازت دیکھیں۔' },
  'chat.errNetwork': { en: 'Speech recognition could not connect. Check your internet connection and try again.', ur: 'آواز پہچاننے کا نظام جڑ نہیں سکا۔ انٹرنیٹ دیکھیں اور دوبارہ کوشش کریں۔' },
  'chat.errVoiceFailed': { en: 'Voice recognition failed{detail}. You can still type your message.', ur: 'آواز پہچاننا ناکام ہو گیا{detail}۔ آپ پیغام لکھ سکتے ہیں۔' },
  'chat.errMicStart': { en: 'The microphone could not be started. Check browser microphone permission and try again.', ur: 'مائیک شروع نہیں ہو سکا۔ براؤزر میں مائیک کی اجازت دیکھیں اور دوبارہ کوشش کریں۔' },
  'chat.errRequest': { en: 'AgriConnect AI could not process your request. Please try again.', ur: 'ایگری کنیکٹ اے آئی آپ کی بات پر کام نہیں کر سکا۔ دوبارہ کوشش کریں۔' },
  'chat.reviewAction': { en: 'Review requested action', ur: 'کام دیکھ کر منظور کریں' },
  'chat.action.CREATE_CROP_BATCH': { en: 'CREATE CROP BATCH', ur: 'فصل لسٹ کرنا' },
  'chat.action.OPEN_CROP_BATCH_FORM': { en: 'OPEN CROP BATCH FORM', ur: 'فصل کا فارم کھولنا' },
} as const satisfies Record<string, Entry>;

export type UiKey = keyof typeof UI;

/* -------------------------------------------------------------------------- */
/* Roles                                                                       */
/* -------------------------------------------------------------------------- */

export const ROLE_NAMES: Record<string, Entry> = {
  FARMER: { en: 'Farmer', ur: 'کسان' },
  ARHTI: { en: 'Arhti (Commission Agent)', ur: 'آڑھتی' },
  VENDOR: { en: 'Wholesale Vendor', ur: 'تھوک فروش' },
  SHOPKEEPER: { en: 'Shopkeeper', ur: 'دکاندار' },
  CONSUMER: { en: 'Consumer', ur: 'صارف' },
  ADMIN: { en: 'Mandi Admin', ur: 'منڈی ایڈمن' },
};

/* -------------------------------------------------------------------------- */
/* Navigation (English label -> Urdu). Existing translations from the app.     */
/* -------------------------------------------------------------------------- */

export const NAV_LABELS: Record<string, string> = {
  'For You': 'آپ کے لیے',
  'My Crops': 'میری فصلیں',
  'Arhti Requests': 'آڑھتی کی طلب',
  'My Deals': 'میرے سودے',
  'Payments & Records': 'حساب کتاب',
  Messages: 'پیغامات',
  'AgriConnect AI': 'اے آئی مددگار',
  Profile: 'پروفائل',
  'Farmer Market': 'کسان منڈی',
  'My Buy Requests': 'خریداری کی طلب',
  'Farmer Deals': 'کسان سودے',
  'Receive & Verify': 'وزن کانٹا',
  'Mandi Inventory': 'گودام',
  'Auction House': 'نیلام گھر',
  'Sales & Commission': 'فروخت',
  'Trade Insights': 'رپورٹ',
  'Mandi Auctions': 'منڈی نیلام',
  'My Warehouse': 'گودام',
  'My Wholesale Shop': 'تھوک دکان',
  'Shopkeeper Orders': 'دکاندار آرڈرز',
  'Wholesale Market': 'تھوک مارکیٹ',
  'My Purchases': 'خریداری',
  'Shop Stock': 'دکان کا اسٹاک',
  'My Storefront': 'میری دکان',
  'Customer Orders': 'گاہک آرڈرز',
  'Shop Insights': 'رپورٹ',
  Home: 'ہوم',
  'Nearby Shops': 'قریبی دکانیں',
  'My Orders': 'میرے آرڈرز',
  'Admin Console': 'ایڈمن پینل',
  'Supply Chain Trace': 'سپلائی چین',
  'Market Insights': 'رپورٹ',
  Crops: 'فصلیں',
  Offers: 'آفرز',
  Deals: 'سودے',
  AI: 'اے آئی',
  Sourcing: 'خریداری',
  Stock: 'گودام',
  Auctions: 'نیلام',
  Shop: 'دکان',
  Buy: 'خریدیں',
  Store: 'دکان',
  Orders: 'آرڈرز',
  Nearby: 'قریب',
  Console: 'پینل',
  Trace: 'ٹریس',
  Insights: 'رپورٹ',
  'Add Crop Batch': 'فصل شامل کریں',
  'Post Buy Request': 'طلب لگائیں',
  'List Wholesale Offer': 'آفر لگائیں',
  'Add Retail Listing': 'ریٹیل لسٹنگ',
  // Links under AI chat replies that are not menu items.
  'Add crop batch': 'فصل شامل کریں',
  'Review Offers': 'آفرز دیکھیں',
  'Open my workspace': 'اپنا پینل کھولیں',
};

/** Same English label, different Urdu for one role ("Stock"). */
export const NAV_ROLE_LABELS: Record<string, string> = {
  'SHOPKEEPER:Stock': 'اسٹاک',
};

export const NAV_SECTIONS: Record<string, string> = {
  'My Farm': 'میرا کھیت',
  Records: 'حساب کتاب',
  'Buying (from farmers)': 'خریداری (کسانوں سے)',
  'Selling (in the mandi)': 'فروخت (منڈی میں)',
  More: 'مزید',
  Procurement: 'خریداری',
  'Wholesale Shop': 'تھوک دکان',
  'Buy Stock': 'مال خریدیں',
  'Sell Retail': 'پرچون فروخت',
  Shop: 'دکان',
  'Mandi Administration': 'منڈی انتظامیہ',
};

/* -------------------------------------------------------------------------- */
/* Fixed values stored in the database                                         */
/* -------------------------------------------------------------------------- */

/** Status values (enums and the settlement/payment status strings). */
export const STATUSES: Record<string, Entry> = {
  // Crop batch
  GROWING: { en: 'Growing', ur: 'فصل کھیت میں' },
  READY_FOR_SALE: { en: 'Ready for sale', ur: 'بکنے کے لیے تیار' },
  NEGOTIATING: { en: 'Negotiating', ur: 'بات چیت جاری' },
  RESERVED: { en: 'Reserved', ur: 'مختص' },
  SOLD_OUT: { en: 'Sold out', ur: 'سب بک گیا' },
  ARCHIVED: { en: 'Archived', ur: 'ہٹایا گیا' },
  // Deal
  AGREED: { en: 'Agreed', ur: 'طے پا گیا' },
  PICKUP_SCHEDULED: { en: 'Pickup scheduled', ur: 'گاڑی طے' },
  PICKED_UP: { en: 'Picked up', ur: 'مال اٹھا لیا' },
  IN_TRANSIT: { en: 'In transit', ur: 'راستے میں' },
  RECEIVED_BY_ARHTI: { en: 'Received by arhti', ur: 'آڑھتی کو مل گیا' },
  WEIGHT_VERIFIED: { en: 'Weight verified', ur: 'وزن ہو گیا' },
  PAYMENT_PENDING: { en: 'Payment pending', ur: 'ادائیگی باقی' },
  PAID: { en: 'Paid', ur: 'ادا ہو گیا' },
  COMPLETED: { en: 'Completed', ur: 'مکمل' },
  CANCELLED: { en: 'Cancelled', ur: 'منسوخ' },
  DISPUTED: { en: 'Disputed', ur: 'تنازع' },
  // Offer
  PENDING: { en: 'Pending', ur: 'جواب باقی' },
  ACCEPTED: { en: 'Accepted', ur: 'منظور' },
  REJECTED: { en: 'Rejected', ur: 'انکار' },
  WITHDRAWN: { en: 'Withdrawn', ur: 'واپس لی گئی' },
  EXPIRED: { en: 'Expired', ur: 'وقت ختم' },
  // Settlement / payment (stored lower-case strings and enums)
  paid: { en: 'Paid', ur: 'ادا ہو گیا' },
  pending: { en: 'Pending', ur: 'باقی' },
  PROCESSING: { en: 'Processing', ur: 'کارروائی جاری' },
  FAILED: { en: 'Failed', ur: 'ناکام' },
  // Delivery tracking
  PICKUP: { en: 'Pickup', ur: 'مال اٹھانا' },
  MANDI_ARRIVAL: { en: 'Mandi arrival', ur: 'منڈی پہنچ گیا' },
  DELIVERED: { en: 'Delivered', ur: 'پہنچ گیا' },
  // User account
  ACTIVE: { en: 'Active', ur: 'فعال' },
  SUSPENDED: { en: 'Suspended', ur: 'معطل' },
};

/** User account status (separate list: PENDING means something else here). */
export const ACCOUNT_STATUSES: Record<string, Entry> = {
  PENDING: { en: 'Pending', ur: 'تصدیق باقی' },
  VERIFIED: { en: 'Verified', ur: 'تصدیق شدہ' },
  SUSPENDED: { en: 'Suspended', ur: 'معطل' },
};

/**
 * Time of day in Urdu mode. The system's Urdu date format writes "AM"/"PM"
 * in English letters, so they are replaced with these words.
 */
export const DAY_PERIODS = {
  AM: { ur: 'قبل دوپہر', unsure: 'Standard Urdu for AM; farmers may prefer صبح / رات depending on the hour.' },
  PM: { ur: 'بعد دوپہر', unsure: 'Standard Urdu for PM; farmers may prefer دوپہر / شام / رات.' },
};

/** Crop grades as stored ("A", "Grade A", "Standard"). */
export const GRADES: Record<string, { ur: string; unsure?: string }> = {
  A: { ur: 'گریڈ اے', unsure: 'Farmers usually say "grade A"; written in Urdu letters.' },
  B: { ur: 'گریڈ بی' },
  C: { ur: 'گریڈ سی' },
  'Grade A': { ur: 'گریڈ اے' },
  'Grade B': { ur: 'گریڈ بی' },
  'Grade C': { ur: 'گریڈ سی' },
  Standard: { ur: 'عام معیار' },
};

/** Packaging values seen in the data. Anything else is shown as typed. */
export const PACKAGING: Record<string, { ur: string; unsure?: string }> = {
  '25 kg plastic crates': { ur: '25 کلو پلاسٹک کریٹ' },
  '50 kg jute bags': { ur: '50 کلو پٹ سن کی بوریاں', unsure: 'Jute = پٹ سن; some say ٹاٹ کی بوریاں.' },
  '40 kg mesh bags': { ur: '40 کلو جالی دار بوریاں' },
};

export const PAYMENT_METHODS: Record<string, { ur: string; unsure?: string }> = {
  'RAAST Instant SBP': { ur: 'راست فوری ادائیگی', unsure: 'RAAST is the State Bank instant payment system.' },
};

/**
 * Places: cities, provinces, mandi names and localities. Compound locations
 * ("Kalu Khan, Swabi, Khyber Pakhtunkhwa") are translated part by part; a
 * part that is not listed is shown as stored. All flagged for review.
 */
export const PLACES: Record<string, { ur: string; unsure?: string }> = {
  // Provinces
  'Khyber Pakhtunkhwa': { ur: 'خیبر پختونخوا' },
  Punjab: { ur: 'پنجاب' },
  Sindh: { ur: 'سندھ' },
  Balochistan: { ur: 'بلوچستان' },
  'Islamabad Capital Territory': { ur: 'اسلام آباد وفاقی علاقہ' },
  // Cities and districts
  Swabi: { ur: 'صوابی' },
  Islamabad: { ur: 'اسلام آباد' },
  Rawalpindi: { ur: 'راولپنڈی' },
  Peshawar: { ur: 'پشاور' },
  Lahore: { ur: 'لاہور' },
  Karachi: { ur: 'کراچی' },
  Okara: { ur: 'اوکاڑہ' },
  Multan: { ur: 'ملتان' },
  Faisalabad: { ur: 'فیصل آباد' },
  Mardan: { ur: 'مردان' },
  Quetta: { ur: 'کوئٹہ' },
  Hyderabad: { ur: 'حیدرآباد' },
  // Localities in the demo data
  'Kalu Khan': { ur: 'کالو خان' },
  'Renala Khurd': { ur: 'رینالہ خورد' },
  'Badami Bagh': { ur: 'بادامی باغ' },
  'Dhoke Kala Khan': { ur: 'ڈھوک کالا خان' },
  'Sector I-11': { ur: 'سیکٹر I-11' },
  'I-10 Industrial Area': { ur: 'I-10 صنعتی علاقہ' },
  'G-11 Markaz': { ur: 'G-11 مرکز' },
  'F-10 Markaz': { ur: 'F-10 مرکز' },
  // Mandis
  'Islamabad Sabzi Mandi': { ur: 'اسلام آباد سبزی منڈی' },
  'Badami Bagh Fruit & Vegetable Market': { ur: 'بادامی باغ فروٹ و سبزی منڈی', unsure: 'Official market name; check the local wording.' },
  'Peshawar Karkhano Sabzi Mandi': { ur: 'پشاور کارخانو سبزی منڈی' },
  'Karachi Sabzi Mandi (Super Highway)': { ur: 'کراچی سبزی منڈی (سپر ہائی وے)' },
  // Header context label: mandi name without the "(…)" part
  'Karachi Sabzi Mandi': { ur: 'کراچی سبزی منڈی' },
};

/* -------------------------------------------------------------------------- */
/* Settlement deduction descriptions                                           */
/* -------------------------------------------------------------------------- */

/** Known description wordings (from lib/actions/deals.ts and the seed). */
export const DEDUCTION_PATTERNS: Array<{ pattern: RegExp; ur: string; unsure?: string }> = [
  { pattern: /^Arhti commission at ([\d.]+)% of Rs ([\d,]+)$/, ur: 'آڑھتی کمیشن {1}%، {2} روپے پر' },
  { pattern: /^Arhti commission at ([\d.]+)%$/, ur: 'آڑھتی کمیشن {1}%' },
  { pattern: /^Mandi cess at ([\d.]+)%$/, ur: 'منڈی ٹیکس {1}%', unsure: 'Mandi cess = منڈی ٹیکس / مارکیٹ فیس.' },
  { pattern: /^Farmer half of Rs ([\d,]+) transport \(shared responsibility\)$/, ur: '{1} روپے کرائے کا آدھا حصہ (خرچ آدھا آدھا)' },
  { pattern: /^Transport share \(farmer\)$/, ur: 'گاڑی کا کرایہ (کسان کا)' },
  { pattern: /^Transport share \(mutual\)$/, ur: 'گاڑی کے کرائے کا آدھا حصہ' },
];

/** Fallback by deduction type when a description wording is not known. */
export const DEDUCTION_TYPES: Record<string, string> = {
  ARHTI_COMMISSION: 'آڑھتی کمیشن',
  TRANSPORT: 'گاڑی کا کرایہ',
  MANDI_CESS: 'منڈی ٹیکس',
  UNLOADING: 'مال اتارنے کا خرچ',
  MARKET_FEE: 'مارکیٹ فیس',
  OTHER: 'دیگر کٹوتی',
};

/* -------------------------------------------------------------------------- */
/* Server error messages                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Messages returned by server actions and form validation (English in the
 * server code). Several validation messages can arrive joined with ", ".
 * Unknown messages are shown as sent.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // Crops
  'Invalid crop selection': 'فصل درست نہیں چنی گئی',
  'Invalid batch': 'لاٹ درست نہیں',
  'Batch not found': 'لاٹ نہیں ملا',
  'This batch is not yours': 'یہ لاٹ آپ کا نہیں',
  'Part of this batch is already committed to a deal and cannot be archived': 'اس لاٹ کا کچھ حصہ سودے میں جا چکا ہے، اسے ہٹایا نہیں جا سکتا',
  'Crop batch not found': 'فصل کا لاٹ نہیں ملا',
  // Offers
  'Invalid response': 'جواب درست نہیں',
  'Offer not found': 'آفر نہیں ملی',
  'This offer has already been answered': 'اس آفر کا جواب پہلے دیا جا چکا ہے',
  'This offer is not addressed to you': 'یہ آفر آپ کے لیے نہیں',
  // Deals
  'Deal not found': 'سودا نہیں ملا',
  'Invalid deal': 'سودا درست نہیں',
  'This deal does not involve your account': 'اس سودے میں آپ کا اکاؤنٹ شامل نہیں',
  'Transport can only be arranged on a newly agreed deal': 'گاڑی صرف نئے طے شدہ سودے پر بک ہو سکتی ہے',
  'The farmer agreed to arrange transport for this deal': 'اس سودے میں گاڑی کسان نے کرنی ہے',
  'The arhti agreed to arrange transport for this deal': 'اس سودے میں گاڑی آڑھتی نے کرنی ہے',
  'Schedule transport before confirming pickup': 'مال اٹھانے کی تصدیق سے پہلے گاڑی بک کریں',
  'This deal is not awaiting pickup confirmation': 'اس سودے میں مال اٹھانے کی تصدیق باقی نہیں',
  // Profile
  'Name is required': 'نام لکھنا ضروری ہے',
  'Shop name is required': 'دکان کا نام لکھنا ضروری ہے',
  // Form validation (lib/validations/workflow.ts)
  'Quantity must be greater than zero': 'مقدار صفر سے زیادہ ہونی چاہیے',
  'Rate must be greater than zero': 'ریٹ صفر سے زیادہ ہونا چاہیے',
  'Select a crop': 'فصل چنیں',
  'Quantity looks too large': 'مقدار بہت زیادہ لگ رہی ہے',
  'Select a grade': 'معیار چنیں',
  'Enter your city or tehsil': 'اپنا شہر یا تحصیل لکھیں',
  'Select your province': 'اپنا صوبہ چنیں',
  'Driver name is required': 'ڈرائیور کا نام لکھنا ضروری ہے',
  'Driver phone is required': 'ڈرائیور کا فون لکھنا ضروری ہے',
  // Login / permission
  'Forbidden: your role cannot perform this action': 'آپ کا اکاؤنٹ یہ کام نہیں کر سکتا',
};

/** Messages that contain numbers. */
export const ERROR_PATTERNS: Array<{ pattern: RegExp; ur: string }> = [
  { pattern: /^Only ([\d.,]+) kg is unsold in this batch — cannot commit ([\d.,]+) kg$/, ur: 'اس لاٹ میں صرف {1} کلو باقی ہے — {2} کلو کا سودا نہیں ہو سکتا' },
  { pattern: /^Only ([\d.,]+) kg of this batch is uncommitted$/, ur: 'اس لاٹ میں صرف {1} کلو باقی ہے' },
];

/**
 * AI chat quick-prompt buttons (English text comes from roleQuickPrompts in
 * lib/actions/ai.ts). In Urdu mode the Urdu text is shown and put in the
 * input box. Each Urdu prompt contains a word the rule-based fallback knows
 * (ریٹ، آفر، سودا، ادائیگی). Other roles follow in phase 2.
 */
export const QUICK_PROMPTS: Record<string, string> = {
  'Tomato rate today?': 'آج ٹماٹر کا ریٹ کیا ہے؟',
  'Any offers for me?': 'کیا میرے لیے کوئی آفر آئی ہے؟',
  'Where is my deal?': 'میرا سودا کہاں تک پہنچا؟',
  'What has been paid?': 'کتنی ادائیگی ہو چکی ہے؟',
};

/** Summaries of AI chat pending actions (written by the server). */
export const CHAT_ACTION_PATTERNS: Array<{ pattern: RegExp; ur: string }> = [
  { pattern: /^List ([\d.,]+) kg (.+) from (.+)$/, ur: '{3} سے {1} کلو {2} لسٹ کریں' },
  { pattern: /^Open the new (.+) batch form$/, ur: '{1} کی نئی فصل کا فارم کھولیں' },
  { pattern: /^Open the new crop batch form$/, ur: 'نئی فصل کا فارم کھولیں' },
];
