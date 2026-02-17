declare module 'emailjs-com' {
  export function init(userId: string): void;
  export function send(serviceId: string, templateId: string, templateParams: any): Promise<any>;
  export function sendForm(serviceId: string, templateId: string, form: HTMLFormElement, userId?: string): Promise<any>;
  const defaultExport: any;
  export default defaultExport;
}
