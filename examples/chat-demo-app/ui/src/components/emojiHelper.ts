const emojiMap: Record<string, string> = {
  // Smiles and positive emotions
  ':)': '😊',
  ':-)': '😊',
  ':D': '😄',
  ':-D': '😄',
  'XD': '🤣',
  ';)': '😉',
  ';-)': '😉',
  ':>': '😃',
  ':->': '😃',
  
  // Negative emotions
  ':(': '😢',
  ':-(': '😢',
  ':/': '😕',
  ':-/': '😕',
  ':@': '😠',
  ':-@': '😠',
  
  // Surprise and shock
  ':o': '😮',
  ':-o': '😮',
  ':O': '😱',
  ':-O': '😱',
  
  // Other expressions
  ':p': '😛',
  ':-p': '😛',
  ':P': '😛',
  ':-P': '😛',
  ':|': '😐',
  ':-|': '😐',
  ':3': '😊',
  
  // Additional emotes
  '<3': '❤️',
  '^_^': '😊',
  '-_-': '😑',
  'o_o': '😳',
  'O_O': '😳',
  'T_T': '😭',
  '¬_¬': '😒',
};

export function replaceTextEmotesWithEmojis(text: string): string {
  const emoteRegex = /(?<=\s|^)[:;XD@OP3<>^T¬\-\/_o]+(?=\s|$)|(?<=\s|^)[()]+(?=\s|$)/g;
  
  return text.replace(emoteRegex, (match) => {
    return emojiMap[match] || match;
  });
}