import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'admin.school_directory.index': { paramsTuple?: []; params?: {} }
    'admin.school_directory.show': { paramsTuple: [ParamValue]; params: {'npsn': ParamValue} }
    'admin.region_changes.index': { paramsTuple?: []; params?: {} }
    'admin.region_changes.accept': { paramsTuple: [ParamValue]; params: {'review': ParamValue} }
    'admin.region_changes.reject': { paramsTuple: [ParamValue]; params: {'review': ParamValue} }
    'admin.area_proposals.index': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.store': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.approve': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.return': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.reject': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.resubmit': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.withdraw': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.login.store': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'admin.logout': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.index': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.store': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.propose': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.hide': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.extracurriculars.unhide': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.extracurriculars.retire': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.layer_packages.index': { paramsTuple?: []; params?: {} }
    'app.layer_packages.follow': { paramsTuple: [ParamValue]; params: {'package': ParamValue} }
    'app.layer_packages.unfollow': { paramsTuple: [ParamValue]; params: {'package': ParamValue} }
    'app.layer_notices.read': { paramsTuple: [ParamValue]; params: {'notice': ParamValue} }
    'app.layer_proposals.index': { paramsTuple?: []; params?: {} }
    'app.layer_proposals.approve': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'app.layer_proposals.reject': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'app.layer_proposals.withdraw': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'app.login': { paramsTuple?: []; params?: {} }
    'app.login.store': { paramsTuple?: []; params?: {} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'app.ai_demo.index': { paramsTuple?: []; params?: {} }
    'app.ai_demo.store': { paramsTuple?: []; params?: {} }
    'app.ai_demo.cancel': { paramsTuple: [ParamValue]; params: {'generation': ParamValue} }
    'app.ai_demo.retry': { paramsTuple: [ParamValue]; params: {'generation': ParamValue} }
    'app.logout': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.login.store': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
    'exam.logout': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'admin.school_directory.index': { paramsTuple?: []; params?: {} }
    'admin.school_directory.show': { paramsTuple: [ParamValue]; params: {'npsn': ParamValue} }
    'admin.region_changes.index': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.index': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.index': { paramsTuple?: []; params?: {} }
    'app.layer_packages.index': { paramsTuple?: []; params?: {} }
    'app.layer_proposals.index': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'app.login': { paramsTuple?: []; params?: {} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'app.ai_demo.index': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'admin.school_directory.index': { paramsTuple?: []; params?: {} }
    'admin.school_directory.show': { paramsTuple: [ParamValue]; params: {'npsn': ParamValue} }
    'admin.region_changes.index': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.index': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.index': { paramsTuple?: []; params?: {} }
    'app.layer_packages.index': { paramsTuple?: []; params?: {} }
    'app.layer_proposals.index': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'app.login': { paramsTuple?: []; params?: {} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'app.ai_demo.index': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'admin.region_changes.accept': { paramsTuple: [ParamValue]; params: {'review': ParamValue} }
    'admin.region_changes.reject': { paramsTuple: [ParamValue]; params: {'review': ParamValue} }
    'admin.area_proposals.store': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.approve': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.return': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.reject': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.resubmit': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.withdraw': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.login.store': { paramsTuple?: []; params?: {} }
    'admin.logout': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.store': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.propose': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.hide': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.extracurriculars.unhide': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.extracurriculars.retire': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.layer_packages.follow': { paramsTuple: [ParamValue]; params: {'package': ParamValue} }
    'app.layer_packages.unfollow': { paramsTuple: [ParamValue]; params: {'package': ParamValue} }
    'app.layer_notices.read': { paramsTuple: [ParamValue]; params: {'notice': ParamValue} }
    'app.layer_proposals.approve': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'app.layer_proposals.reject': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'app.layer_proposals.withdraw': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'app.login.store': { paramsTuple?: []; params?: {} }
    'app.ai_demo.store': { paramsTuple?: []; params?: {} }
    'app.ai_demo.cancel': { paramsTuple: [ParamValue]; params: {'generation': ParamValue} }
    'app.ai_demo.retry': { paramsTuple: [ParamValue]; params: {'generation': ParamValue} }
    'app.logout': { paramsTuple?: []; params?: {} }
    'exam.login.store': { paramsTuple?: []; params?: {} }
    'exam.logout': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}