/**
 * Round 15 (AC4): the insults and, at the same number, each one's own comeback.
 * Original lines, pasta-themed, in French (user: "French taunt"); the rules only
 * know the numbers (domain/duel.ts). ` ` keeps French spacing before ! and :
 * without letting the mark wrap alone onto the next line.
 */
export const INSULTS: readonly { readonly insult: string; readonly comeback: string }[] = [
  { insult: 'Ta sauce sort d’un bocal !', comeback: 'Alors ouvre-le, si tes petites mains y arrivent.' },
  { insult: 'Mes boulettes sont plus futées que toi !', comeback: 'C’est pour ça qu’elles te fuient.' },
  { insult: 'Tu casses tes spaghettis en deux, barbare !', comeback: 'Et toi, tu mets de la crème dans ta carbonara.' },
  { insult: 'Tu sens le parmesan de trois semaines !', comeback: 'Arrête de me renifler, c’est gênant.' },
  { insult: 'Je vais te hacher comme un oignon !', comeback: 'Attention : c’est toi qui vas pleurer.' },
  { insult: 'Ta grand-mère cuisine mieux que toi !', comeback: 'C’est vrai. Elle t’a aussi appris à perdre.' },
  { insult: 'Tu vas cramer comme une lasagne oubliée !', comeback: 'Seulement si c’est toi qui règles le minuteur.' },
  { insult: 'J’ai touillé de meilleures sauces avec mon coude !', comeback: 'Ça explique les poils dans ta sauce.' },
];
