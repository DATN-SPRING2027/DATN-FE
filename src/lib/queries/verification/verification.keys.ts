export const verificationKeys = {
  all: ["verification"] as const,
  inbox: () => [...verificationKeys.all, "inbox"] as const,
  detail: (id: string) => [...verificationKeys.all, "detail", id] as const,
};
