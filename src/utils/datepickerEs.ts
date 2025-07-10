// Archivo de utilidades para españolizar react-datepicker
import { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';

registerLocale('es', es);

export default es;
