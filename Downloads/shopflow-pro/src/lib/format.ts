export const fmtKES = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 2 }).format(n);

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

export const resolveUnitPrice = (price: number, discountPrice?: number | null) => {
  if (discountPrice == null) return price;
  if (discountPrice <= 0 || discountPrice >= price) return price;
  return discountPrice;
};

export const usernameFromEmail = (email?: string | null, fallback = "Unknown") => {
  if (!email) return fallback;
  const [username] = email.split("@");
  return username || fallback;
};
