type Opening = { day: number; opens: string; closes: string };

export function isRestaurantOpen(localDate: string, hours: Opening[]) {
  const clock = localDate.slice(11, 16);
  const weekday = new Date(localDate.slice(0, 10) + "T12:00:00Z").getUTCDay();
  const yesterday = (weekday + 6) % 7;
  return hours.some(({ day, opens, closes }) => {
    if (opens === closes) return false;
    if (opens < closes) return day === weekday && opens <= clock && clock < closes;
    return (day === weekday && clock >= opens) || (day === yesterday && clock < closes);
  });
}
