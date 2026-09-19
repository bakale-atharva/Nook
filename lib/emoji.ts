// A curated set rather than the full Unicode list: enough for everyday team
// chat, no third-party picker to restyle, and nothing to keep up to date.

export const HEART_EMOJI = "❤️";

export const QUICK_REACTIONS = ["👍", HEART_EMOJI, "😂", "🎉", "👀", "🙏"] as const;

export type EmojiCategory = {
  id: string;
  label: string;
  emojis: string[];
};

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😉",
      "😊", "😇", "🥰", "😍", "🤩", "😘", "😋", "😛", "😜", "🤪",
      "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😌", "😴", "🤤",
      "😎", "🤓", "🥳", "😕", "😟", "🙁", "😮", "😲", "😳", "🥺",
      "😢", "😭", "😤", "😠", "😡", "🤯", "😱", "😰", "🤗", "🫡",
    ],
  },
  {
    id: "gestures",
    label: "Gestures",
    emojis: [
      "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👏", "🙌", "🫶",
      "🤝", "🙏", "💪", "👋", "🤚", "✋", "🖖", "👆", "👇", "👉",
      "👈", "☝️", "✍️", "🤙", "🫰", "🤌",
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💖", "💗", "💘", "💝",
    ],
  },
  {
    id: "celebrate",
    label: "Celebrate",
    emojis: [
      "🎉", "🎊", "🥂", "🍾", "🎈", "🎁", "🏆", "🥇", "🎯", "🚀",
      "🔥", "✨", "⭐", "🌟", "💯", "💥", "🌈", "☀️",
    ],
  },
  {
    id: "things",
    label: "Things",
    emojis: [
      "💡", "📌", "📎", "📝", "📅", "📈", "📉", "📊", "🔒", "🔑",
      "🔧", "🛠️", "⚙️", "💻", "📱", "🎧", "☕", "🍕", "🍺", "🍰",
      "🌱", "🐛", "🦄", "🐶", "🐱",
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    emojis: [
      "✅", "❌", "⚠️", "❓", "❗", "➕", "➖", "💬", "👀", "🧠",
      "⏰", "⏳", "🚧", "🚨", "🔔", "📣",
    ],
  },
];
