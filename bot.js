require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const bodyParser = require("body-parser");
const quizzes = require("./data");

// Access the token from the environment variables
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable");
}

// Set up Express app
const app = express();
app.use(bodyParser.json());

const bot = new TelegramBot(TOKEN, { polling: true });

let userQuizzes = {};

// Handle private messages
bot.onText(/\/question/, (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name;

  userQuizzes[userId] = {
    currentQuestion: 1,
    answers: [],
    startTime: Date.now(),
    username: username,
  };

  bot.sendMessage(
    userId,
    "Welcome to the quiz! You will receive quiz questions shortly."
  );
  sendQuestion(userId, 1);
});

// Handle group messages
bot.onText(/\/question/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "Please start the quiz in a private message by typing /question."
  );
});

bot.on("callback_query", (callbackQuery) => {
  const userId = callbackQuery.from.id;
  const answer = parseInt(callbackQuery.data);
  const chatId = callbackQuery.message.chat.id;

  if (!userQuizzes[userId]) {
    bot.sendMessage(chatId, "Please start the quiz by typing /question.");
    return;
  }

  const userQuiz = userQuizzes[userId];
  const questionIndex = userQuiz.currentQuestion;
  const quiz = quizzes[questionIndex];

  userQuiz.answers.push(answer);
  userQuiz.currentQuestion++;

  if (
    userQuiz.currentQuestion > Object.keys(quizzes).length ||
    Date.now() - userQuiz.startTime > 60 * 1000 // 1 minute (60 seconds)
  ) {
    sendResults(chatId, userId);
  } else {
    sendQuestion(userId, userQuiz.currentQuestion);
  }
});

function sendQuestion(userId, questionIndex) {
  const quiz = quizzes[questionIndex];
  const options = quiz.options.map((option, index) => ({
    text: option,
    callback_data: index.toString(),
  }));

  bot.sendMessage(userId, quiz.question, {
    reply_markup: {
      inline_keyboard: options.map((option) => [option]),
    },
  });
}

function sendResults(chatId, userId) {
  const userQuiz = userQuizzes[userId];
  let score = 0;

  userQuiz.answers.forEach((answer, index) => {
    if (answer === quizzes[index + 1].correct) {
      score++;
    }
  });

  const scoreMessage = `User ${userQuiz.username} scored ${score}/${
    Object.keys(quizzes).length
  }`;

  // Send score to user
  bot.sendMessage(
    userId,
    `You scored ${score}/${Object.keys(quizzes).length} in the quiz.`
  );

  // Send score to group chat
  bot.sendMessage(chatId, scoreMessage);

  delete userQuizzes[userId];
}

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
