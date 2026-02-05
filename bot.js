require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const userService = require('./services/userService');
const orderService = require('./services/orderService');
const fraudService = require('./services/fraudService');
const ratingService = require('./services/ratingService');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Admin IDs
const ADMIN_IDS = process.env.ADMIN_IDS?.split(',').map(id => parseInt(id)) || [];

// User states (registratsiya jarayoni uchun)
const userStates = new Map();

// Pending orders (5 sekund kutish uchun)
const pendingOrders = new Map();

// ========== KLAVIATURALAR ==========

const mainMenuPassenger = {
  reply_markup: {
    keyboard: [
      ['🚖 Taksi chaqirish', '📋 Mening buyurtmalarim'],
      ['👤 Profil', '⭐ Reyting'],
      ['🔗 Referal havola', '📞 Yordam']
    ],
    resize_keyboard: true
  }
};

const mainMenuDriver = {
  reply_markup: {
    keyboard: [
      ['✅ Aktiv', '❌ Nofaol'],
      ['📋 Mening buyurtmalarim', '📊 Statistika'],
      ['👤 Profil', '⭐ Reyting'],
      ['🔗 Referal havola', '📞 Yordam']
    ],
    resize_keyboard: true
  }
};

const mainMenuAdmin = {
  reply_markup: {
    keyboard: [
      ['👥 Foydalanuvchilar', '📊 Statistika'],
      ['🚨 Shikoyatlar', '🔝 Top haydovchilar'],
      ['📢 Xabar yuborish', '⚙️ Sozlamalar']
    ],
    resize_keyboard: true
  }
};

const cancelKeyboard = {
  reply_markup: {
    keyboard: [['❌ Bekor qilish']],
    resize_keyboard: true
  }
};

// ========== YORDAMCHI FUNKSIYALAR ==========

function isAdmin(userId) {
  return ADMIN_IDS.includes(userId);
}

function formatOrder(order) {
  let text = `📍 *Buyurtma #${order.id}*\n\n`;
  text += `Qayerdan: ${order.from_location}\n`;
  text += `Qayerga: ${order.to_location}\n`;
  
  if (order.price) text += `💰 Narx: ${order.price} so'm\n`;
  if (order.distance) text += `📏 Masofa: ${order.distance} km\n`;
  
  text += `📅 Sana: ${new Date(order.created_at).toLocaleString('uz-UZ')}\n`;
  text += `📊 Holat: ${getStatusText(order.status)}\n`;
  
  if (order.passenger_name) text += `\n👤 Yo'lovchi: ${order.passenger_name}\n`;
  if (order.passenger_phone) text += `📞 Telefon: ${order.passenger_phone}\n`;
  
  if (order.driver_name) {
    text += `\n🚗 Haydovchi: ${order.driver_name}\n`;
    if (order.car_model) text += `Mashina: ${order.car_model} (${order.car_number})\n`;
  }
  
  return text;
}

function getStatusText(status) {
  const statuses = {
    'pending': '⏳ Kutilmoqda',
    'assigned': '🔔 Tayinlangan',
    'accepted': '✅ Qabul qilingan',
    'in_progress': '🚗 Yo\'lda',
    'completed': '✔️ Yakunlangan',
    'cancelled': '❌ Bekor qilingan'
  };
  return statuses[status] || status;
}

// ========== START VA REGISTRATSIYA ==========

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const referralCode = match[1]; // Referal kod (agar mavjud bo'lsa)

  try {
    let user = await userService.getOrCreateUser(userId, msg.from.username);

    // Referal tekshirish
    if (referralCode && !user.referrer_id) {
      const referrerId = parseInt(referralCode);
      if (referrerId !== userId) {
        await userService.addReferral(referrerId, userId);
        await bot.sendMessage(chatId, '🎉 Siz referal havola orqali qo\'shildingiz!');
      }
    }

    // Admin tekshirish
    if (isAdmin(userId) && user.role !== 'admin') {
      await userService.updateUser(userId, { role: 'admin' });
      user.role = 'admin';
    }

    if (user.role === 'admin') {
      await bot.sendMessage(
        chatId,
        `Assalomu alaykum, Admin! 👋\n\nSiz admin paneliga kirgansiz.`,
        mainMenuAdmin
      );
      return;
    }

    // Agar foydalanuvchi hali registratsiyadan o'tmagan bo'lsa
    if (!user.phone || !user.full_name) {
      await bot.sendMessage(
        chatId,
        `Assalomu alaykum! 👋\n\nTaksi botimizga xush kelibsiz!\n\nIltimos, quyidagi ma'lumotlarni to'ldiring:`,
        { reply_markup: { remove_keyboard: true } }
      );
      
      await bot.sendMessage(
        chatId,
        '📝 Iltimos, to\'liq ismingizni kiriting:',
        cancelKeyboard
      );
      
      userStates.set(userId, { step: 'waiting_name', role: 'passenger' });
      return;
    }

    // Role tanlov (agar haydovchi emas bo'lsa)
    const isDriver = await userService.isDriver(userId);
    
    if (!isDriver) {
      await bot.sendMessage(
        chatId,
        'Siz qaysi sifatda foydalanmoqchisiz?',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚖 Yo\'lovchi', callback_data: 'role_passenger' }],
              [{ text: '🚗 Haydovchi', callback_data: 'role_driver' }]
            ]
          }
        }
      );
    } else {
      await bot.sendMessage(
        chatId,
        `Xush kelibsiz, ${user.full_name}! 🚗`,
        mainMenuDriver
      );
    }

  } catch (error) {
    console.error('Start error:', error);
    await bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
  }
});

// ========== REGISTRATSIYA JARAYONI ==========

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (!userStates.has(userId)) return;

  const state = userStates.get(userId);

  try {
    if (text === '❌ Bekor qilish') {
      userStates.delete(userId);
      await bot.sendMessage(chatId, 'Bekor qilindi.', { reply_markup: { remove_keyboard: true } });
      return;
    }

    // Yo'lovchi registratsiyasi
    if (state.step === 'waiting_name') {
      state.full_name = text;
      state.step = 'waiting_phone';
      
      await bot.sendMessage(
        chatId,
        '📞 Telefon raqamingizni kiriting (masalan: +998901234567):',
        {
          reply_markup: {
            keyboard: [
              [{ text: '📱 Telefon raqamni yuborish', request_contact: true }],
              ['❌ Bekor qilish']
            ],
            resize_keyboard: true
          }
        }
      );
      return;
    }

    if (state.step === 'waiting_phone') {
      let phone = text;
      
      if (msg.contact) {
        phone = msg.contact.phone_number;
      }

      await userService.savePassengerInfo(userId, {
        phone: phone,
        full_name: state.full_name
      });

      userStates.delete(userId);

      await bot.sendMessage(
        chatId,
        `✅ Ro'yxatdan muvaffaqiyatli o'tdingiz!\n\n👤 Ism: ${state.full_name}\n📞 Telefon: ${phone}`,
        { reply_markup: { remove_keyboard: true } }
      );

      // Role tanlash
      await bot.sendMessage(
        chatId,
        'Siz qaysi sifatda foydalanmoqchisiz?',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚖 Yo\'lovchi', callback_data: 'role_passenger' }],
              [{ text: '🚗 Haydovchi', callback_data: 'role_driver' }]
            ]
          }
        }
      );
      return;
    }

    // Haydovchi registratsiyasi
    if (state.step === 'driver_car_model') {
      state.car_model = text;
      state.step = 'driver_car_number';
      
      await bot.sendMessage(
        chatId,
        '🔢 Mashina raqamini kiriting (masalan: 01A123BC):',
        cancelKeyboard
      );
      return;
    }

    if (state.step === 'driver_car_number') {
      state.car_number = text;
      state.step = 'driver_car_color';
      
      await bot.sendMessage(
        chatId,
        '🎨 Mashina rangini kiriting:',
        cancelKeyboard
      );
      return;
    }

    if (state.step === 'driver_car_color') {
      await userService.saveDriverInfo(userId, {
        car_model: state.car_model,
        car_number: state.car_number,
        car_color: text
      });

      userStates.delete(userId);

      await bot.sendMessage(
        chatId,
        `✅ Haydovchi sifatida muvaffaqiyatli ro'yxatdan o'tdingiz!\n\n🚗 Mashina: ${state.car_model}\n🔢 Raqam: ${state.car_number}\n🎨 Rang: ${text}\n\nAdmin tasdiqlashini kuting.`,
        mainMenuDriver
      );
      return;
    }

    // Buyurtma yaratish jarayoni
    if (state.step === 'order_from') {
      state.from_location = text;
      state.step = 'order_to';
      
      await bot.sendMessage(
        chatId,
        '📍 Qayerga bormoqchisiz?',
        cancelKeyboard
      );
      return;
    }

    if (state.step === 'order_to') {
      state.to_location = text;
      userStates.delete(userId);
      
      // Buyurtma yaratish
      const orderId = await orderService.createOrder(userId, {
        from_location: state.from_location,
        to_location: text,
        price: state.price || null
      });

      await bot.sendMessage(
        chatId,
        `✅ Buyurtma yaratildi!\n\n📍 Qayerdan: ${state.from_location}\n📍 Qayerga: ${text}\n\nHaydovchilar qidirilyapti...`,
        mainMenuPassenger
      );

      // Haydovchilarga yuborish
      await distributeOrderToDrivers(orderId);
      return;
    }

  } catch (error) {
    console.error('Message handler error:', error);
    await bot.sendMessage(chatId, 'Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    userStates.delete(userId);
  }
});

// ========== CALLBACK QUERY HANDLERS ==========

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);

    // Role tanlash
    if (data === 'role_passenger') {
      await userService.updateUser(userId, { role: 'passenger' });
      await bot.sendMessage(chatId, 'Siz yo\'lovchi sifatida foydalanasiz.', mainMenuPassenger);
      return;
    }

    if (data === 'role_driver') {
      userStates.set(userId, { step: 'driver_car_model', role: 'driver' });
      
      await bot.sendMessage(
        chatId,
        '🚗 Mashina modelini kiriting (masalan: Chevrolet Lacetti):',
        cancelKeyboard
      );
      return;
    }

    // Buyurtmani qabul qilish
    if (data.startsWith('accept_order_')) {
      const orderId = parseInt(data.split('_')[2]);
      
      const order = await orderService.getOrder(orderId);
      
      if (order.status !== 'pending') {
        await bot.sendMessage(chatId, '❌ Bu buyurtma allaqachon qabul qilingan yoki bekor qilingan.');
        return;
      }

      // Buyurtmani haydovchiga biriktirish
      await orderService.assignDriver(orderId, userId);
      await orderService.acceptOrder(orderId);

      // Haydovchiga xabar
      await bot.sendMessage(
        chatId,
        `✅ Buyurtmani qabul qildingiz!\n\n${formatOrder(await orderService.getOrder(orderId))}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚗 Yo\'lda', callback_data: `start_order_${orderId}` }],
              [{ text: '❌ Bekor qilish', callback_data: `cancel_order_${orderId}` }]
            ]
          }
        }
      );

      // Yo'lovchiga xabar
      const orderData = await orderService.getOrder(orderId);
      await bot.sendMessage(
        orderData.passenger_id,
        `✅ Haydovchi topildi!\n\n${formatOrder(orderData)}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '❌ Bekor qilish', callback_data: `cancel_order_${orderId}` }]
            ]
          }
        }
      );

      // Pending orders-dan o'chirish
      if (pendingOrders.has(orderId)) {
        clearTimeout(pendingOrders.get(orderId).timeout);
        pendingOrders.delete(orderId);
      }

      return;
    }

    // Buyurtmani boshlash
    if (data.startsWith('start_order_')) {
      const orderId = parseInt(data.split('_')[2]);
      await orderService.startOrder(orderId);
      
      const order = await orderService.getOrder(orderId);
      
      await bot.sendMessage(
        chatId,
        `🚗 Buyurtma boshlandi!\n\n${formatOrder(order)}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ Yakunlash', callback_data: `complete_order_${orderId}` }]
            ]
          }
        }
      );

      await bot.sendMessage(
        order.passenger_id,
        '🚗 Haydovchi yo\'lda!'
      );
      return;
    }

    // Buyurtmani yakunlash
    if (data.startsWith('complete_order_')) {
      const orderId = parseInt(data.split('_')[2]);
      await orderService.completeOrder(orderId);
      
      const order = await orderService.getOrder(orderId);
      
      await bot.sendMessage(chatId, `✅ Buyurtma yakunlandi!\n\n${formatOrder(order)}`);
      await bot.sendMessage(order.passenger_id, `✅ Buyurtma yakunlandi!\n\n${formatOrder(order)}`);

      // Reyting so'rash
      await bot.sendMessage(
        order.passenger_id,
        'Haydovchini baholang:',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '⭐', callback_data: `rate_${orderId}_${order.driver_id}_1` },
                { text: '⭐⭐', callback_data: `rate_${orderId}_${order.driver_id}_2` },
                { text: '⭐⭐⭐', callback_data: `rate_${orderId}_${order.driver_id}_3` }
              ],
              [
                { text: '⭐⭐⭐⭐', callback_data: `rate_${orderId}_${order.driver_id}_4` },
                { text: '⭐⭐⭐⭐⭐', callback_data: `rate_${orderId}_${order.driver_id}_5` }
              ]
            ]
          }
        }
      );

      await bot.sendMessage(
        order.driver_id,
        'Yo\'lovchini baholang:',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '⭐', callback_data: `rate_${orderId}_${order.passenger_id}_1` },
                { text: '⭐⭐', callback_data: `rate_${orderId}_${order.passenger_id}_2` },
                { text: '⭐⭐⭐', callback_data: `rate_${orderId}_${order.passenger_id}_3` }
              ],
              [
                { text: '⭐⭐⭐⭐', callback_data: `rate_${orderId}_${order.passenger_id}_4` },
                { text: '⭐⭐⭐⭐⭐', callback_data: `rate_${orderId}_${order.passenger_id}_5` }
              ]
            ]
          }
        }
      );
      return;
    }

    // Reyting qo'yish
    if (data.startsWith('rate_')) {
      const parts = data.split('_');
      const orderId = parseInt(parts[1]);
      const toUser = parseInt(parts[2]);
      const rating = parseInt(parts[3]);

      try {
        await ratingService.addRating(orderId, userId, toUser, rating);
        await bot.sendMessage(chatId, `✅ Reyting qo'yildi: ${rating} ⭐`);
      } catch (error) {
        await bot.sendMessage(chatId, error.message);
      }
      return;
    }

    // Buyurtmani bekor qilish
    if (data.startsWith('cancel_order_')) {
      const orderId = parseInt(data.split('_')[2]);
      
      await orderService.cancelOrder(orderId, userId, 'Foydalanuvchi tomonidan bekor qilindi');
      
      const order = await orderService.getOrder(orderId);
      
      await bot.sendMessage(chatId, `❌ Buyurtma bekor qilindi.`);
      
      // Ikkinchi tomonga xabar
      if (order.driver_id && order.driver_id !== userId) {
        await bot.sendMessage(order.driver_id, `❌ Buyurtma #${orderId} bekor qilindi.`);
      }
      if (order.passenger_id !== userId) {
        await bot.sendMessage(order.passenger_id, `❌ Buyurtma #${orderId} bekor qilindi.`);
      }

      // Agar haydovchi bekor qilgan bo'lsa, keyingisiga yuborish
      if (userId === order.driver_id && order.status === 'assigned') {
        await offerToNextDriver(orderId);
      }
      
      return;
    }

  } catch (error) {
    console.error('Callback query error:', error);
    await bot.sendMessage(chatId, 'Xatolik yuz berdi.');
  }
});

// ========== BUYURTMALARNI TAQSIMLASH ==========

async function distributeOrderToDrivers(orderId) {
  try {
    const drivers = await userService.getAvailableDrivers();
    
    if (drivers.length === 0) {
      const order = await orderService.getOrder(orderId);
      await bot.sendMessage(
        order.passenger_id,
        '😔 Hozirda bo\'sh haydovchilar yo\'q. Iltimos, keyinroq urinib ko\'ring.'
      );
      await orderService.cancelOrder(orderId, 0, 'Bo\'sh haydovchilar yo\'q');
      return;
    }

    // Birinchi haydovchiga taklif qilish
    await offerToDriver(orderId, drivers[0], 0);

  } catch (error) {
    console.error('Distribute order error:', error);
  }
}

async function offerToDriver(orderId, driver, driverIndex) {
  try {
    const order = await orderService.getOrder(orderId);
    
    if (order.status !== 'pending') return;

    // Priority score (referral count asosida)
    const priorityScore = driver.referral_count || 0;
    
    await orderService.offerToDriver(orderId, driver.telegram_id, priorityScore);

    await bot.sendMessage(
      driver.telegram_id,
      `🔔 Yangi buyurtma!\n\n${formatOrder(order)}\n\n⏰ 5 sekund ichida javob bering!`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Qabul qilish', callback_data: `accept_order_${orderId}` }],
            [{ text: '❌ Rad etish', callback_data: `cancel_order_${orderId}` }]
          ]
        }
      }
    );

    // 5 sekund kutish
    const timeoutId = setTimeout(async () => {
      const currentOrder = await orderService.getOrder(orderId);
      
      if (currentOrder.status === 'pending') {
        // Timeout
        const offer = await orderService.getOffer(orderId, driver.telegram_id);
        if (offer) {
          await orderService.recordDriverResponse(offer.id, 'timeout');
        }
        
        await bot.sendMessage(driver.telegram_id, '⏰ Vaqt tugadi! Buyurtma keyingi haydovchiga yuborildi.');
        
        // Keyingi haydovchiga yuborish
        await offerToNextDriver(orderId);
      }
    }, 5000); // 5 sekund

    // Timeout-ni saqlash
    pendingOrders.set(orderId, {
      timeout: timeoutId,
      currentDriverIndex: driverIndex
    });

  } catch (error) {
    console.error('Offer to driver error:', error);
  }
}

async function offerToNextDriver(orderId) {
  try {
    const drivers = await userService.getAvailableDrivers();
    const rejectedDrivers = await orderService.getRejectedDrivers(orderId);
    const rejectedIds = rejectedDrivers.map(d => d.driver_id);

    // Rad etilmagan haydovchilarni topish
    const availableDrivers = drivers.filter(d => !rejectedIds.includes(d.telegram_id));

    if (availableDrivers.length === 0) {
      const order = await orderService.getOrder(orderId);
      await bot.sendMessage(
        order.passenger_id,
        '😔 Hech bir haydovchi buyurtmani qabul qilmadi. Iltimos, qaytadan urinib ko\'ring.'
      );
      await orderService.cancelOrder(orderId, 0, 'Haydovchilar rad etdi');
      return;
    }

    // Keyingi haydovchiga taklif
    await offerToDriver(orderId, availableDrivers[0], 0);

  } catch (error) {
    console.error('Offer to next driver error:', error);
  }
}

// ========== TEXT COMMAND HANDLERS ==========

bot.onText(/🚖 Taksi chaqirish/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const activeOrder = await orderService.getActiveOrder(userId, 'passenger');
    
    if (activeOrder) {
      await bot.sendMessage(
        chatId,
        `Sizda aktiv buyurtma mavjud:\n\n${formatOrder(activeOrder)}`
      );
      return;
    }

    userStates.set(userId, { step: 'order_from' });
    
    await bot.sendMessage(
      chatId,
      '📍 Qayerdan ketasiz? (Manzilni kiriting yoki geolokatsiyani yuboring)',
      cancelKeyboard
    );

  } catch (error) {
    console.error('Order creation error:', error);
    await bot.sendMessage(chatId, 'Xatolik yuz berdi.');
  }
});

bot.onText(/📋 Mening buyurtmalarim/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const role = await userService.getUserRole(userId);
    const orders = await orderService.getUserOrders(userId, role);

    if (orders.length === 0) {
      await bot.sendMessage(chatId, 'Sizda hali buyurtmalar yo\'q.');
      return;
    }

    let text = '📋 *Buyurtmalar tarixi:*\n\n';
    
    orders.slice(0, 10).forEach((order, index) => {
      text += `${index + 1}. ${formatOrder(order)}\n\n`;
    });

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Orders history error:', error);
    await bot.sendMessage(chatId, 'Xatolik yuz berdi.');
  }
});

bot.onText(/👤 Profil/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const user = await userService.getOrCreateUser(userId);
    const stats = await userService.getUserStats(userId);
    const ratingInfo = await ratingService.getAverageRating(userId);

    let text = `👤 *Profil ma\'lumotlari:*\n\n`;
    text += `Ism: ${user.full_name || 'Kiritilmagan'}\n`;
    text += `Telefon: ${user.phone || 'Kiritilmagan'}\n`;
    text += `Rol: ${user.role === 'driver' ? '🚗 Haydovchi' : '🚖 Yo\'lovchi'}\n`;
    text += `⭐ Reyting: ${ratingInfo.average.toFixed(1)} (${ratingInfo.total} baho)\n`;
    text += `📊 Yakunlangan: ${stats?.completed_orders || 0}\n`;
    text += `❌ Bekor qilingan: ${stats?.cancelled_orders || 0}\n`;
    text += `👥 Referallar: ${user.referral_count || 0}\n`;

    if (user.role === 'driver') {
      const driverInfo = await userService.isDriver(userId);
      if (driverInfo) {
        // Driver ma'lumotlarini ko'rsatish
      }
    }

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Profile error:', error);
    await bot.sendMessage(chatId, 'Xatolik yuz berdi.');
  }
});

bot.onText(/🔗 Referal havola/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const user = await userService.getOrCreateUser(userId);
    const botUsername = (await bot.getMe()).username;
    const referralLink = `https://t.me/${botUsername}?start=${userId}`;

    let text = `🔗 *Sizning referal havolangiz:*\n\n`;
    text += `${referralLink}\n\n`;
    text += `👥 Hozirgi referallar soni: ${user.referral_count || 0}\n\n`;
    text += `📝 Referal tizimi qanday ishlaydi?\n`;
    text += `• Do'stingiz havolangiz orqali botga kiradi\n`;
    text += `• Har bir yangi referal uchun buyurtmalar sizga birinchi bo'lib keladi\n`;
    text += `• Ko'proq referal = ko'proq buyurtma! 🚀`;

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Referral error:', error);
    await bot.sendMessage(chatId, 'Xatolik yuz berdi.');
  }
});

// ========== ISHGA TUSHIRISH ==========

console.log('🚀 Bot ishga tushdi...');

module.exports = bot;
