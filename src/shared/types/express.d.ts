// biome-ignore lint/style/noNamespace: Express module augmentation requires namespace syntax
declare namespace Express {
  interface Request {
    id?: string;
  }
}
