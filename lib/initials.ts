/** Up to two capital letters from a person's name, for avatars. */
export function initialsOf(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}
