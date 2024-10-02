const emojiMap: Record<string, string> = {
    // Smiles and positive emotions
    'sourit': '😊',
    'smiles': '😊',
    'rit': '😄',
    'laughs': '😄',
    'rire aux éclats': '🤣',
    'laughs out loud': '🤣',
    'clin d\'oeil': '😉',
    'winks': '😉',
    'warmly': '🤗',
    'chaleureusement': '🤗',
    'excité': '😃',
    'excited': '😃',
    'heureux': '😄',
    'happy': '😄',
    'joyeux': '😊',
    'joyful': '😊',
    
    // Thinking and pondering
    'réfléchit': '🤔',
    'thinks': '🤔',
    'pense': '💭',
    'ponders': '💭',
    'curieux': '🧐',
    'curious': '🧐',
    
    // Negative emotions
    'triste': '😢',
    'sad': '😢',
    'inquiet': '😟',
    'worried': '😟',
    'confus': '😕',
    'confused': '😕',
    'frustré': '😤',
    'frustrated': '😤',
    'en colère': '😠',
    'angry': '😠',
    
    // Surprise and shock
    'surpris': '😮',
    'surprised': '😮',
    'choqué': '😱',
    'shocked': '😱',
    'bouche bée': '😲',
    'jaw drops': '😲',
    
    // Gestures and actions
    'hoche la tête': '🙂',
    'nods': '🙂',
    'fronce les sourcils': '😟',
    'frowns': '😟',
    'soupire': '😮‍💨',
    'sighs': '😮‍💨',
    'applaudit': '👏',
    'applauds': '👏',
    'pouce en l\'air': '👍',
    'thumbs up': '👍',
    'pouce en bas': '👎',
    'thumbs down': '👎',
    'lève la main': '🙋',
    'raises hand': '🙋',
    
    // Miscellaneous
    'cœur': '❤️',
    'heart': '❤️',
    'cligne des yeux': '😳',
    'blinks': '😳',
    'bâille': '🥱',
    'yawns': '🥱',
    'dort': '😴',
    'sleeps': '😴',
    'rêve': '💤',
    'dreams': '💤',
    'réfléchit profondément': '🧠',
    'thinks deeply': '🧠',
    'a une idée': '💡',
    'has an idea': '💡',
    'fête': '🎉',
    'celebrates': '🎉',
    
    // Sarcasm and humor
    'sarcastic': '😏',
    'sarcastique': '😏',
    'rolls eyes': '🙄',
    'lève les yeux au ciel': '🙄',
    'plaisante': '😜',
    'jokes': '😜',
    
    // Professional and formal
    'serre la main': '🤝',
    'shakes hands': '🤝',
    'salue': '👋',
    'waves': '👋',
    'présente': '👨‍🏫',
    'presents': '👨‍🏫',
    'cheerfully': '😄',
    'gaiement': '😄',
    'joyeusement': '😄',
    
    // Technology and modern life
    'tape sur le clavier': '⌨️',
    'types': '⌨️',
    'prend une photo': '📸',
    'takes a photo': '📸',
    'regarde son téléphone': '📱',
    'checks phone': '📱'
  };
  
  const defaultEmoji = '🌟'; // Using a star emoji as default

  export function replaceTextEmotesWithEmojis(text: string): string {
    return text.replace(/\*(.*?)\*/g, (match, p1) => {
      const lowercaseEmote = p1.toLowerCase().trim();
      return emojiMap[lowercaseEmote] || defaultEmoji;
    });
  }
  