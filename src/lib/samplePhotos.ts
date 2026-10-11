/**
 * Las fotos de muestra: las que el formulario público dejó sin usar.
 *
 * La muestra de datos de ejemplo quiere que el almacén del taller enseñe lo que
 * enseña de verdad —fotos que alguien subió por el formulario público y que
 * ninguna incidencia cita, con la limpieza de la madrugada esperando a
 * llevárselas—, y para eso hacen falta archivos de verdad en el almacén, no
 * filas apuntando a la nada: la tarjeta de Ajustes del taller las enseña como
 * miniaturas y la papelera las distingue por su tipo.
 *
 * Los bytes van aquí, dentro del código, porque el almacén solo se escribe
 * desde una acción (storage.store), y una acción no lee ficheros del disco: lo
 * que esté en el bundle es lo que puede guardar. Son PNG pequeños y válidos
 * —80×60, un degradado con una franja—, generados una vez y guardados aquí
 * en base64: no pretenden parecer averías, solo ser imágenes de verdad.
 *
 * El vale es el de una subida del formulario —el mismo formato aleatorio de
 * la tabla reportUploads— y los días dicen cuánto llevan ahí: pasado el día de
 * cortesía, la limpieza de la noche ya se las lleva.
 */

/** Una foto de la muestra: su vale, lo que lleva ahí y sus bytes. */
export interface SamplePhoto {
  /** El vale que la acreditó, con el mismo formato que reparte el formulario. */
  ticket: string;
  /** Cuántos días lleva sin que nadie la cite (más de un día: ya toca limpiarla). */
  ageDays: number;
  /** La foto en PNG, en base64. */
  base64: string;
}

/** Las fotos que carga la muestra, de la más reciente a la más antigua. */
export const SAMPLE_PHOTOS: readonly SamplePhoto[] = [
  {
    ticket: "3f1a9c60b2d84e57ac1e0d5b7c9a4f21",
    ageDays: 2,
    base64:
      "iVBORw0KGgoAAAANSUhEUgAAAFAAAAA8CAIAAAB+RarbAAAE5ElEQVR42t3Zd1PTBxgH8OdNabVWax2VvSHsGUL2IHuHBEhIQshOIIQQCDPsjSIouFDBga2trW1tbWtr62voedz1em2FPCHjF17C57/vgBNpDSfSySfTySczGj/KbDyVSTmVRTmd1XQ6m5pNNeVQzbk0cx69M59hKWB2FbCshSxrEdtWzLGXcB0knoPU7Czlu8r47nKBp0LoqRR5K8XdVZKeaklPjdRXK+utk/vrFP56ZV+DKkBW9Teqg42aIKVloEk7SNWFaLoQvXWI3jbMaB9h6kdYhlG2YYzTMc4xhrmmMM880dw5ybdMCSxTgq5poXVGZJsV2+ckjjmpY17qXJC5FuXuRYVnSeldVnlXVN0r6p5Vje9qS+81rX9N27em67veGlhv699oD27oB27oB2/Ch7Qf51DP5NCOmdYwuAkHaM/k0j7Jox8nbUdoEw7Wns1jnM1nHButcWgLDtWey2eeK2AeD61p+BZEov20kHW+kHUMtOaR2xCh9nwR+7NiTqprzaN3IHLthWLOhRJuSms734Mx2osk7kUSL3W1lrG7kE01obSXSnmXS5tTVNs1fg/2sxRKe7mM/3k5PxW11vA2/J2lUNor5YIrFYKU09omtuGfyRGlTasUplWKUktrm7wP/0qOKG16lSijSpxCWvvUA/hvTkZpM6rFmTWSVNE6ph7C/+ZklDazRpJVK00JrXN6Bz7UClDa7DpZdp2M+FrXzA4c0ApQ2px6eW6DnOBa9+wuHNyBUNrcBkUeWUFkrXvuERzagVDaPLIyv1FFWK1n/jFE0vhQ2gKKqoCiJqbW+x4cWeNDaQub1EVUDQG13QtPIPJ+i9IWUVuKaS1E0/YsPgVUv0Vpi+naErqWUFrf0h5g2zxKS2LoSAwdcbS+5T2Ios2jtKXM1jJWG0G0vSvPILrtAqUtY7WVs9uJoPWvfgFRbxcobTmnvYKjT7q2b/VLOMpSg9JWcvWVXENytYGrz+GISw1KW8XrqG7uSKI2cO05HH2XQmmrm401fGOytP1rX0FMdimUtkZgqhWYk6INXv8aYrXCobR1QnOdqDPx2oH1FxDDFQ6lrRd11ostCdYOrr+A2G6OKG2D2EKWdCVSG9r4BmK+OaK0ZKm1UWpNmDZ041uIx8KK0lJkNorclhjt0M2XEKeFFaVtktubFPYEaIc3X0L89mSUlqpw0JTOeGtHtr6DuO7JKC1N5aSrXHHVjm59D/Fez1FahtrF0Ljjpx279QMkYD1HaZkaN7PFEyft2O1XkJivAKVlab1srTce2vE7ryBhXwFKy9Z1c3TdMdeG7/4IiXxGUFpuaw+3zRdb7cS9nyDBzwhKy2vz8dp7Y6id3H4Nif+BUNpmfS9f74+Vdmr7NSTlB0Jp+Qa/wNAXE+3U/Z8hWa8XSivsCAiNgaNrpx/8Akl8vVBakbFfZOo/onbm4a+Q3I8PpRWbgxJz8Cja2Z03kPSPD6WVdA5ILYNRa+d23wARHk2UVmoZlHWFotPO7/4GBHk0UVp5V0huHYpCO//odyDOf4vSKmzDStswVrvw+C0Q6r9FaZX2EZVjBKVdfPIWCPVW+5b3UFqVY1TtHI1cu/T0DyCUdj9LobQa55jGNR6hdnnvTyCadj9LobQt7nGtOxyJdmXvHRBQu5+lUFqtJ6zzThyqXXn27i9SSX/1TI88KwAAAABJRU5ErkJggg==",
  },
  {
    ticket: "b7c4e0218f3d49a6b5c82e0f1d730a94",
    ageDays: 3,
    base64:
      "iVBORw0KGgoAAAANSUhEUgAAAFAAAAA8CAIAAAB+RarbAAAE4ElEQVR42tXa+V/SBxzH8c8/1X2sO29RRFFRPECQ+74EQRAEQRDkUFBEVLzPysrKysrKym1tc1vb2ta2trWtbf0Fe/jo8dhje1TG8QG+/AnPHz/v1wea8/Yw8vcw8vcyC/YyC/a1FO5jFe1nFe1nFx9gFx9oLTnIKT3IKT3EJR1ycUm9vDI3v8wjKPcIyH1CsldU4RNT/BKKX1IZkFb1y6gDcmpQUR1U1ISUNYOq2iE1LayhhTV1w231ES19REePtjdE2xtH9Y1jhqbxjuaYsTlmZEyYmJOdLVPmlmkLa9rCnuliz1pb52yc+W7OfDd3wc5bdPCXevjLTsGyU3jOJTzfK7rgFq94xCseycU+6SWv7LJPtuqXr/oVVwKKq/3KawOqtaBqLai+HtLcGGy7OdS2Htauh3W3hnUQp5ZLOswrO5zr2tuRdohfyy8/wi8/ktPaOyN6SEgrIB8VkI/mrnYjugNOTCus+EBEOZaj2o2oAZLQiijHxJXHc1F7d7QDktOKK49Lqk7knPbemBGS1kqpJ6TUk7mlvT9uhFS0suqTsupTOaTdjJkgRa285pSi9nSuaDdjnZC6VlF7Wkk7kxPaBxOdgKJV0s6o6s4SX/tw0gxYWnX9WXV9HsG1j6YsgKjV0PM09Hwia7emLeDikhC1bQ0F2sYCwmq3prvg9cWHqNU2FuqaComp/XDGCv9efIhaXVNRe3MRAbUfzdrgv/ctolbPKNYziomm/XhuB/y/+xZRa2CWGJglhNI+nu+GN695RG1HS6mRVUoc7eN5O7z1mkfUGlkkE5tEEO0nC3Z413aBqDWxyzpby4ig/XTRAbtsF4haM6fczCnPuvazpR7YfalB1Fq4ZAuXnF3t9nIPvHepQdR28SqsfEoWtdvLTohnl0LUWvkUm6AyW9rPz7kgzl0KUWsTVHYLq7Ki/eJ8L8S/wiFq7aIqu4iaee2XF3bACaxwiFqHmOoQV2dY+2TFDYlujojaHkm1U1qTSe2TFQ8ksTkiap3SGpesNmPary56ILmFFVHrktX2ymmZ0X59qQ+SXlgRtW4Fza2oy4D2m8teSGVPRtR6lHUeZX26tU9XvZDinoyo7VPRvWp6WrVPV32Q+nqOqPWqG3yahvRpv73iB5T1HFHr0zT62xrTpP3uagCwWgGiNqBtCmib0qH9/toOGK0VIGr7dc39umZ07bO1fsAtI4jagXZGUM/A1T5bGwD0MoKoDeqZIQMTUfvD9QFIRwdC1IYMLYMdLVjaH28EIU0dCFE7ZGQNGVko2p9uhiB91QtRGzaxwyZ26trn6yFIa/VC1A53tkbMnBS1z9cHId2ND1EbMXNGLNxUtD/fGoIMND5E7YiFG+3iJa395XYYMlM0EbWjVt6olZ+c9tc7O+AMFU1E7ZiNP2YTJKF9sTEMmey3iNrxbkHMLkxU+2IjAhnut4jamF044RAlpP3tbgQyX6sRtRMO0WSPOH7t7/dGICu1GlE75RRPOSVxav+4H4VstXlE7bRLMu2SxqN9uRmFLLZ5RO1Mr2zWLXuv9uXmKGT3EwFRO+uWz3nku2v/fDAGWf9EQNTOeRTzfYpdtH89HAci/F0gahe8ygWv8l3avx/tgLP/d7G93IOoXfSpFn2qt2pfbcWACNrXFx+idsmvXg6o39S+2pr4B9Wu4bw7ocNmAAAAAElFTkSuQmCC",
  },
  {
    ticket: "9d20f5ac4b1e47836c0a8d2f5b46e17c",
    ageDays: 5,
    base64:
      "iVBORw0KGgoAAAANSUhEUgAAAFAAAAA8CAIAAAB+RarbAAAExElEQVR42t3ZZVfbBxQG8PvV2pVCobiGJMTdjbi7QAKEkEACwd3dtXTS+dZt3brto2wsZ+fsVO4g+k8+wu/Vvc/zwCNS1SPS08fdTx93V39Crn5CriEbGRQjg2JiUs2sHgubZmHTrRy6jcuw85gOPsvBZzsFbJeQ4xZx3SKeR8z3Svg+qcAvE/plooBcHFSIQ0pJSCntU8n61fKwRh7WKCK9ygGtalCnHtKrh/SaqKF32KiNmXQxk27ErI9bDAmrMWE1jdpMY3Zz0mFJOa0pp23cZZtw29MeR9rjnPS6pnyuab97JuCZCXhng765kG++zz/fF1joDy6GQ0uR0FKkb3mgf2UwvDoUWYtG1qID68ODG7GhzZHo5kh0Kz68nYB3tE8oNVXUZ5Wqje2MwvvaKmrt057aitSO/AP+gLa6p66aVld52vjuGHxMW0N7XkOvrzBtfC8JiPYZo76W0VBJ2sR+CshGBqKtZTbUMRsrRjt6MA6ZC4Ro61iNz1lNlaEduwP/e4EQbT27uZ7TXAHa5OEE/PfeItoGTksDt6XctcmjNLxzbxFtI7e1idda1trU8SS8/10g2iZ+WzO/vXy148eT8MHvAtE2C9pbBB1lqp04mYKP/VKItlXY0SrsLEdt+nQakF8K0baJutrEXWWnTZ/NAP45Itp2MalDQiov7eT5LPzv54hoOyTdndLuMtJOnc/Cff5kRNspJXfJKOWinb6Yg3v+yYiWJKeQ5NSy0M5czsP9UwGi7VZQuxU9xNfOXC3Ag1IBoiUreygqGsG1s1cL8NAMhGgpKjpVTSeydu56EbLIQIiWqmb0aBiE1c7fLEF2iQ/R0jRMWi+LmNqFF8uQdeJDtHQti65lE1B7B84l3yJaho7N1HGIpl28XYEc8y2iZeo5LD2XUNqll6uQe5pHtCwDj23kEUe7/Oka5CXNI1qOkc8x8QmiXflsHfLVXSBarknANQuIoL0D57G7QLQ8i5BvEZVcu/r5BuS3qUG0fKtIYBWXVrv2xSbkvalBtAKbWGiTlFC7/moLCtFLIVqRXSpySEul3Xi1BQXqpRCt2CETO2Ul0W58uQ2Fa+EQrcQpl7rkxddufrUDBW3hEK3UpZC5lUXWbn29C4XuHBGtzKOUe1TF1G5nwIXuHBGtwqtSeNVF0+58swfFaVgRrdKnVvo1xdHufLsPRWtYEa3K36sO9BZBu/vdARSzT0a06oBWE9QWWrv3/SEUuU9GtJqgrjekK6h2/w5c9PYc0Wr79No+Q+G0Bz8cQUnac0Sr6zfo+o0F0h78eAyl2goQrT5sNIRNhdAevj6BEm4FiNYQMRsHzHnXHr0+gdIuI4jWOGAxDVryqz3+6RRKvowgWvOg1TxkzaP25OczIMIOhGgtUZslas+X9uSXcyDIDoRorcN227AjL9rTNxdAnNUL0dpiDnvMmbv27M0FEGr1QrT2Eacj7spRe/7rJRBt40O0zrjbmXDnor347QoIuPEhWlfC4xr1ZK29eHsNBFw0F29XEK171OsZ82WnvXx7DQTUZi4QovUkfd6kPwvt1e83QExt5gIhWm/K70sFHqq9/uMFEFabuUCI1j8e8E8EH6S9+fMWiKzNXCBEG5gIBdKh+2v/Bv8Fnslzp7dq6pIAAAAASUVORK5CYII=",
  },
];

/** Los 64 caracteres del alfabeto base64, para decodificar a mano. */
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Los bytes de una foto de la muestra. El decodificador va a mano porque el
 * entorno de las funciones de Convex no trae atob ni Buffer, y para estas tres
 * fotos —que se escriben en el código en base64, que ocupa la cuarta parte— no
 * hace falta nada más. Se saltan los caracteres que no son del alfabeto, así que
 * da igual dónde se parta la línea.
 *
 * El tipo dice de qué memoria salen los bytes —y no un `Uint8Array` a secas—
 * porque quien los guarda los mete en un `Blob`, y un `Blob` solo acepta bytes
 * de un `ArrayBuffer`: la muestra no comparte memoria con nadie.
 */
export function samplePhotoBytes(photo: SamplePhoto): Uint8Array<ArrayBuffer> {
  const clean = photo.base64.replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let pending = 0;
  let at = 0;
  for (const char of clean) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value < 0) continue;
    bits = (bits << 6) | value;
    pending += 6;
    if (pending >= 8) {
      pending -= 8;
      bytes[at] = (bits >> pending) & 0xff;
      at += 1;
    }
  }
  return at === bytes.length ? bytes : bytes.slice(0, at);
}
