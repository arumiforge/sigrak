import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'admin.schools.index': { paramsTuple?: []; params?: {} }
    'admin.schools.show': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.schools.invite': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.schools.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'school': ParamValue,'invitation': ParamValue} }
    'admin.schools.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'school': ParamValue,'invitation': ParamValue} }
    'admin.schools.trial': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.users.index': { paramsTuple?: []; params?: {} }
    'admin.users.trial': { paramsTuple: [ParamValue]; params: {'user': ParamValue} }
    'admin.settings.show': { paramsTuple?: []; params?: {} }
    'admin.settings.update': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.login.store': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'admin.logout': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'app.login': { paramsTuple?: []; params?: {} }
    'app.login.store': { paramsTuple?: []; params?: {} }
    'app.password.forgot': { paramsTuple?: []; params?: {} }
    'app.password.email': { paramsTuple?: []; params?: {} }
    'app.password.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.password.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.sign_up': { paramsTuple?: []; params?: {} }
    'app.sign_up.store': { paramsTuple?: []; params?: {} }
    'app.invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.logout': { paramsTuple?: []; params?: {} }
    'app.account.show': { paramsTuple?: []; params?: {} }
    'app.account.update': { paramsTuple?: []; params?: {} }
    'app.account.password': { paramsTuple?: []; params?: {} }
    'app.role_switch.show': { paramsTuple?: []; params?: {} }
    'app.role_switch.store': { paramsTuple?: []; params?: {} }
    'app.teachers.index': { paramsTuple?: []; params?: {} }
    'app.teachers.invite': { paramsTuple?: []; params?: {} }
    'app.teachers.resend': { paramsTuple: [ParamValue]; params: {'invitation': ParamValue} }
    'app.teachers.cancel': { paramsTuple: [ParamValue]; params: {'invitation': ParamValue} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'app.ai_demo.index': { paramsTuple?: []; params?: {} }
    'app.ai_demo.store': { paramsTuple?: []; params?: {} }
    'app.ai_demo.cancel': { paramsTuple: [ParamValue]; params: {'generation': ParamValue} }
    'app.ai_demo.retry': { paramsTuple: [ParamValue]; params: {'generation': ParamValue} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.login.store': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
    'exam.logout': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'admin.schools.index': { paramsTuple?: []; params?: {} }
    'admin.schools.show': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.users.index': { paramsTuple?: []; params?: {} }
    'admin.settings.show': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'app.login': { paramsTuple?: []; params?: {} }
    'app.password.forgot': { paramsTuple?: []; params?: {} }
    'app.password.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.sign_up': { paramsTuple?: []; params?: {} }
    'app.invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.account.show': { paramsTuple?: []; params?: {} }
    'app.role_switch.show': { paramsTuple?: []; params?: {} }
    'app.teachers.index': { paramsTuple?: []; params?: {} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'app.ai_demo.index': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'admin.schools.index': { paramsTuple?: []; params?: {} }
    'admin.schools.show': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.users.index': { paramsTuple?: []; params?: {} }
    'admin.settings.show': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'app.login': { paramsTuple?: []; params?: {} }
    'app.password.forgot': { paramsTuple?: []; params?: {} }
    'app.password.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.sign_up': { paramsTuple?: []; params?: {} }
    'app.invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.account.show': { paramsTuple?: []; params?: {} }
    'app.role_switch.show': { paramsTuple?: []; params?: {} }
    'app.teachers.index': { paramsTuple?: []; params?: {} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'app.ai_demo.index': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'admin.schools.invite': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.schools.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'school': ParamValue,'invitation': ParamValue} }
    'admin.schools.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'school': ParamValue,'invitation': ParamValue} }
    'admin.schools.trial': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.users.trial': { paramsTuple: [ParamValue]; params: {'user': ParamValue} }
    'admin.settings.update': { paramsTuple?: []; params?: {} }
    'admin.login.store': { paramsTuple?: []; params?: {} }
    'admin.logout': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'app.login.store': { paramsTuple?: []; params?: {} }
    'app.password.email': { paramsTuple?: []; params?: {} }
    'app.password.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.sign_up.store': { paramsTuple?: []; params?: {} }
    'app.invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.logout': { paramsTuple?: []; params?: {} }
    'app.account.update': { paramsTuple?: []; params?: {} }
    'app.account.password': { paramsTuple?: []; params?: {} }
    'app.role_switch.store': { paramsTuple?: []; params?: {} }
    'app.teachers.invite': { paramsTuple?: []; params?: {} }
    'app.teachers.resend': { paramsTuple: [ParamValue]; params: {'invitation': ParamValue} }
    'app.teachers.cancel': { paramsTuple: [ParamValue]; params: {'invitation': ParamValue} }
    'app.ai_demo.store': { paramsTuple?: []; params?: {} }
    'app.ai_demo.cancel': { paramsTuple: [ParamValue]; params: {'generation': ParamValue} }
    'app.ai_demo.retry': { paramsTuple: [ParamValue]; params: {'generation': ParamValue} }
    'exam.login.store': { paramsTuple?: []; params?: {} }
    'exam.logout': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}