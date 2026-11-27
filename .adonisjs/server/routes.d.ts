import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'app.login': { paramsTuple?: []; params?: {} }
    'app.login.store': { paramsTuple?: []; params?: {} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'app.logout': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.login.store': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'admin.logout': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.login.store': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
    'exam.logout': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'app.login': { paramsTuple?: []; params?: {} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'app.login': { paramsTuple?: []; params?: {} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'app.login.store': { paramsTuple?: []; params?: {} }
    'app.logout': { paramsTuple?: []; params?: {} }
    'admin.login.store': { paramsTuple?: []; params?: {} }
    'admin.logout': { paramsTuple?: []; params?: {} }
    'exam.login.store': { paramsTuple?: []; params?: {} }
    'exam.logout': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}