/**
 * Nota informativa técnica al pie sobre las restricciones de red, SMTP y pasarela de correo.
 */
export function MailNoticeFooter() {
  return (
    <p className="mt-4 text-xs leading-5 text-muted-foreground">
      El envío se hace por la API del servicio. Un servidor SMTP no se puede
      hablar directamente desde el backend del taller —no abre conexiones TCP—:
      se usa a través de un relevo HTTP. Por ahí salen «Relevo propio», la
      cuenta de Gmail y el buzón de pruebas de Ethereal, que además le mandan al
      relevo su servidor y su cuenta con el propio correo. Los códigos de acceso
      por correo siguen saliendo por la pasarela de la plataforma, no por este
      servicio.
    </p>
  );
}
