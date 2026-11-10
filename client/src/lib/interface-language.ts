import type { Language } from '../../../shared/user-preferences';
import generated from './interface-catalog.json';
import europeanPortuguese from './interface-catalog-pt-pt.json';
const portugal: Record<string, string> = europeanPortuguese;
const catalog: Record<string, readonly string[]> = generated;

// Only curated interface copy belongs here. Never translate user data or legal evidence.
export const interfaceCopy: Record<string, readonly [string,string]> = {
  'Pagar aporte':['Pay contribution','Pagar aporte'],
  'Aporte de {0}':['Contribution of {0}','Aporte de {0}'],
  'Ler e aceitar MOU · revisão {0}':['Read and accept MOU · revision {0}','Leer y aceptar el MOU · revisión {0}'],
  'O MAP Inicial da BIA {0} mudou para a revisão {1}. Leia o documento atualizado e confirme seu aceite antes da ativação.':['The initial MAP for BIA {0} has changed to revision {1}. Read the updated document and confirm your acceptance before activation.','El MAP inicial de la BIA {0} ha cambiado a la revisión {1}. Lee el documento actualizado y confirma tu aceptación antes de la activación.'],
  'Configurações':['Settings','Configuración'],
  'Aparência':['Appearance','Apariencia'],
  'Aparência e preferências de uso da plataforma.':['Appearance and platform preferences.','Apariencia y preferencias de uso de la plataforma.'],
  'Aparência, notificações por e-mail e idioma.':['Appearance, email notifications and language.','Apariencia, notificaciones por correo e idioma.'],
  'Escolha como deseja visualizar a plataforma.':['Choose how you want to view the platform.','Elige cómo quieres ver la plataforma.'],
  'Tema da plataforma':['Platform theme','Tema de la plataforma'],
  'Claro':['Light','Claro'], 'Escuro':['Dark','Oscuro'],
  'Padrão da plataforma':['Platform default','Predeterminado de la plataforma'],
  'Fundos claros e textos escuros':['Light backgrounds and dark text','Fondos claros y textos oscuros'],
  'Fundos escuros e textos claros':['Dark backgrounds and light text','Fondos oscuros y textos claros'],
  'A alteração é aplicada imediatamente e fica salva neste navegador. Não altera seus dados, marcas ou documentos.':['Changes apply immediately and are saved in this browser. Your data, branding and documents remain unchanged.','El cambio se aplica al instante y se guarda en este navegador. No modifica tus datos, marcas ni documentos.'],
  'Notificações por e-mail':['Email notifications','Notificaciones por correo'],
  'Escolha quais e-mails deseja receber. Os avisos dentro da plataforma continuam disponíveis.':['Choose which emails to receive. In-app notifications remain available.','Elige qué correos quieres recibir. Los avisos dentro de la plataforma siguen disponibles.'],
  'Convites':['Invitations','Invitaciones'],
  'Convites para comunidades, BIAs, reuniões e imóveis compartilhados.':['Invitations to communities, BIAs, meetings and shared properties.','Invitaciones a comunidades, BIAs, reuniones e inmuebles compartidos.'],
  'Agenda e lembretes':['Calendar and reminders','Agenda y recordatorios'],
  'Chamadas de aliança e lembretes de vencimento.':['Alliance calls and due-date reminders.','Convocatorias de alianzas y recordatorios de vencimiento.'],
  'Atualizações de BIAs':['BIA updates','Actualizaciones de BIAs'],
  'Solicitações, respostas e novos integrantes nas suas alianças.':['Requests, responses and new participants in your alliances.','Solicitudes, respuestas y nuevos integrantes de tus alianzas.'],
  'Oportunidades e demandas':['Opportunities and requests','Oportunidades y demandas'],
  'Pulsos das ROs':['RO pulses','Pulsos de las ROs'],
  'Avisos por e-mail de Reuniões de Oportunidades divulgadas nas suas comunidades.':['Email notices for Opportunity Meetings shared in your communities.','Avisos por correo de Reuniones de Oportunidades difundidas en tus comunidades.'],
  'Novas oportunidades e manifestações de interesse.':['New opportunities and expressions of interest.','Nuevas oportunidades y manifestaciones de interés.'],
  'Comunidade e rede':['Community and network','Comunidad y red'],
  'Novos membros, candidaturas e lembretes de avaliação de Aura.':['New members, applications and Aura review reminders.','Nuevos miembros, candidaturas y recordatorios de evaluación de Aura.'],
  'Mensagens essenciais continuam ativas: recuperação de senha, acesso à conta, termos, decisões cadastrais e comunicações de pagamento.':['Essential messages remain active: password recovery, account access, terms, account decisions and payment communications.','Los mensajes esenciales siguen activos: recuperación de contraseña, acceso a la cuenta, términos, decisiones de registro y comunicaciones de pago.'],
  'Idioma':['Language','Idioma'],
  'Idioma da interface':['Interface language','Idioma de la interfaz'],
  'Português (Portugal)':['Português (Portugal)','Português (Portugal)'],
  'Português (Brasil)':['Português (Brasil)','Português (Brasil)'],
  'O idioma escolhido se aplica aos textos da interface.':['The selected language applies to the interface.','El idioma seleccionado se aplica a la interfaz.'],
  'Salvar preferências':['Save preferences','Guardar preferencias'],
  'Salvando…':['Saving…','Guardando…'],
  'Preferências salvas.':['Preferences saved.','Preferencias guardadas.'],
  'Carregando preferências…':['Loading preferences…','Cargando preferencias…'],
  'Não foi possível carregar suas preferências.':['Unable to load your preferences.','No se pudieron cargar tus preferencias.'],
  'Não foi possível salvar. Suas preferências anteriores foram mantidas.':['Unable to save. Your previous preferences were retained.','No se pudo guardar. Se conservaron tus preferencias anteriores.'],
  'Tentar novamente':['Try again','Intentar de nuevo'],
  'As preferências de e-mail e idioma ficam salvas na sua conta.':['Email and language preferences are saved to your account.','Las preferencias de correo e idioma se guardan en tu cuenta.'],
  'Início':['Home','Inicio'], 'Agenda e Alertas':['Calendar and Alerts','Agenda y alertas'],
  'Vitrine':['Showcase','Vitrina'], 'Área de Vitrine':['Showcase','Vitrina'], 'BUILT Vitrine':['BUILT Showcase','BUILT Vitrina'],
  'Alianças':['Alliances','Alianzas'], 'Área de Alianças':['Alliances','Alianzas'], 'Administração':['Administration','Administración'],
  'Meu Perfil':['My Profile','Mi perfil'], 'Voltar para Meu Perfil':['Back to My Profile','Volver a Mi perfil'],
  'Gerencie suas informações por categoria.':['Manage your information by category.','Gestiona tu información por categoría.'],
  'Identidade e contato':['Identity and contact','Identidad y contacto'],
  'Informações básicas, foto, localização e formalização.':['Basic information, photo, location and formal details.','Información básica, foto, ubicación y formalización.'],
  'Atuação e interesses':['Expertise and interests','Actividad e intereses'],
  'Sua atuação profissional, expertise e áreas de interesse.':['Your professional experience, expertise and interests.','Tu actividad profesional, experiencia y áreas de interés.'],
  'Empresa e Vitrine':['Company and Showcase','Empresa y Vitrina'],
  'Informações da empresa e presença na Vitrine BUILT.':['Company information and presence in the BUILT Showcase.','Información de la empresa y presencia en la Vitrina BUILT.'],
  'Conta e segurança':['Account and security','Cuenta y seguridad'],
  'Acesso, senha e seu link pessoal de convite.':['Access, password and your personal invitation link.','Acceso, contraseña y tu enlace personal de invitación.'],
  'Editar':['Edit','Editar'], 'Abrir':['Open','Abrir'], 'Completo':['Complete','Completo'],
  'Imóveis compartilhados':['Shared properties','Inmuebles compartidos'],
  'Convites de aliança':['Alliance invitations','Invitaciones de alianza'],
  'Alianças compartilhadas':['Shared alliances','Alianzas compartidas'],
};
export function translateInterface(source: string, language: Language): string {
  if (language === 'pt-BR' || !source.trim()) return source;
  const key = source.trim().replace(/\s+/g, ' ');
  const row = Object.hasOwn(interfaceCopy, key) ? interfaceCopy[key] : Object.hasOwn(catalog, key) ? catalog[key] : undefined;
  const value = language === 'pt-PT' ? (Object.hasOwn(portugal, key) ? portugal[key] : undefined) : row?.[language === 'en' ? 0 : 1];
  if (!value || (key.match(/\{\d+\}/g) || []).sort().join() !== (value.match(/\{\d+\}/g) || []).sort().join()) return source;
  return source.slice(0,source.length-source.trimStart().length) + value + source.slice(source.trimEnd().length);
}
