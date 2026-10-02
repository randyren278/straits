/** Compile-time public flag for client navigation; server routes enforce the gate separately. */
export const IS_CANARY_CLIENT = process.env.NEXT_PUBLIC_STRAITS_CANARY === '1';
