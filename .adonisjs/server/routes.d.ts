import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'admin.school_directory.index': { paramsTuple?: []; params?: {} }
    'admin.school_directory.show': { paramsTuple: [ParamValue]; params: {'npsn': ParamValue} }
    'admin.region_changes.index': { paramsTuple?: []; params?: {} }
    'admin.region_changes.accept': { paramsTuple: [ParamValue]; params: {'review': ParamValue} }
    'admin.region_changes.reject': { paramsTuple: [ParamValue]; params: {'review': ParamValue} }
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
    'admin.area_proposals.index': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.store': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.approve': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.return': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.reject': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.resubmit': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.withdraw': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.calendar_console.index': { paramsTuple?: []; params?: {} }
    'admin.calendar_console.import': { paramsTuple?: []; params?: {} }
    'admin.calendar_console.activate': { paramsTuple: [ParamValue]; params: {'package': ParamValue} }
    'admin.announcements.index': { paramsTuple?: []; params?: {} }
    'admin.announcements.create': { paramsTuple?: []; params?: {} }
    'admin.announcements.target_options': { paramsTuple?: []; params?: {} }
    'admin.announcements.store': { paramsTuple?: []; params?: {} }
    'admin.announcements.edit': { paramsTuple: [ParamValue]; params: {'announcement': ParamValue} }
    'admin.announcements.update': { paramsTuple: [ParamValue]; params: {'announcement': ParamValue} }
    'admin.announcements.unpublish': { paramsTuple: [ParamValue]; params: {'announcement': ParamValue} }
    'admin.announcements.destroy': { paramsTuple: [ParamValue]; params: {'announcement': ParamValue} }
    'admin.events.index': { paramsTuple?: []; params?: {} }
    'admin.events.create': { paramsTuple?: []; params?: {} }
    'admin.events.store': { paramsTuple?: []; params?: {} }
    'admin.events.edit': { paramsTuple: [ParamValue]; params: {'event': ParamValue} }
    'admin.events.update': { paramsTuple: [ParamValue]; params: {'event': ParamValue} }
    'admin.events.unpublish': { paramsTuple: [ParamValue]; params: {'event': ParamValue} }
    'admin.events.destroy': { paramsTuple: [ParamValue]; params: {'event': ParamValue} }
    'admin.stories.index': { paramsTuple?: []; params?: {} }
    'admin.stories.create': { paramsTuple?: []; params?: {} }
    'admin.stories.store': { paramsTuple?: []; params?: {} }
    'admin.stories.edit': { paramsTuple: [ParamValue]; params: {'story': ParamValue} }
    'admin.stories.update': { paramsTuple: [ParamValue]; params: {'story': ParamValue} }
    'admin.stories.unpublish': { paramsTuple: [ParamValue]; params: {'story': ParamValue} }
    'admin.stories.destroy': { paramsTuple: [ParamValue]; params: {'story': ParamValue} }
    'admin.legal.index': { paramsTuple?: []; params?: {} }
    'admin.legal.start': { paramsTuple: [ParamValue]; params: {'key': ParamValue} }
    'admin.legal.edit': { paramsTuple: [ParamValue]; params: {'document': ParamValue} }
    'admin.legal.update': { paramsTuple: [ParamValue]; params: {'document': ParamValue} }
    'admin.legal.publish': { paramsTuple: [ParamValue]; params: {'document': ParamValue} }
    'admin.legal.destroy': { paramsTuple: [ParamValue]; params: {'document': ParamValue} }
    'admin.staff.index': { paramsTuple?: []; params?: {} }
    'admin.staff.store': { paramsTuple?: []; params?: {} }
    'admin.staff.scope_options': { paramsTuple?: []; params?: {} }
    'admin.staff.show': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.staff.grant': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.staff.scope': { paramsTuple: [ParamValue,ParamValue]; params: {'staff': ParamValue,'role': ParamValue} }
    'admin.staff.revoke': { paramsTuple: [ParamValue,ParamValue]; params: {'staff': ParamValue,'role': ParamValue} }
    'admin.staff.disable': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.staff.enable': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.staff.resend_link': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.activity_log.index': { paramsTuple?: []; params?: {} }
    'admin.access_matrix.index': { paramsTuple?: []; params?: {} }
    'admin.staff_password.edit': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'admin.staff_password.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
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
    'app.academic_years.index': { paramsTuple?: []; params?: {} }
    'app.academic_years.store': { paramsTuple?: []; params?: {} }
    'app.academic_years.edit': { paramsTuple: [ParamValue]; params: {'academicYear': ParamValue} }
    'app.academic_years.update': { paramsTuple: [ParamValue]; params: {'academicYear': ParamValue} }
    'app.academic_years.destroy': { paramsTuple: [ParamValue]; params: {'academicYear': ParamValue} }
    'app.academic_years.copy_classes': { paramsTuple: [ParamValue]; params: {'academicYear': ParamValue} }
    'app.classes.index': { paramsTuple?: []; params?: {} }
    'app.classes.store': { paramsTuple?: []; params?: {} }
    'app.classes.show': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.classes.update': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.classes.destroy': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.classes.assign': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.timetable.index': { paramsTuple?: []; params?: {} }
    'app.timetable.compose': { paramsTuple?: []; params?: {} }
    'app.timetable.settings': { paramsTuple?: []; params?: {} }
    'app.timetable.drafts.store': { paramsTuple?: []; params?: {} }
    'app.timetable.drafts.show': { paramsTuple: [ParamValue]; params: {'draft': ParamValue} }
    'app.timetable.drafts.reshuffle': { paramsTuple: [ParamValue]; params: {'draft': ParamValue} }
    'app.timetable.drafts.save': { paramsTuple: [ParamValue]; params: {'draft': ParamValue} }
    'app.timetable.class.show': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.timetable.class.store': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.timetable.class.update': { paramsTuple: [ParamValue,ParamValue]; params: {'class': ParamValue,'slot': ParamValue} }
    'app.timetable.class.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'class': ParamValue,'slot': ParamValue} }
    'app.timetable.class.lock': { paramsTuple: [ParamValue,ParamValue]; params: {'class': ParamValue,'slot': ParamValue} }
    'app.timetable.mine': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'app.calendar.store': { paramsTuple?: []; params?: {} }
    'app.calendar.update': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.calendar.destroy': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.calendar.hide': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.calendar.unhide': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.calendar.propose': { paramsTuple?: []; params?: {} }
    'app.calendar.acknowledge': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'app.announcements.index': { paramsTuple?: []; params?: {} }
    'app.announcements.read_all': { paramsTuple?: []; params?: {} }
    'app.announcements.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
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
    'app.email_confirmation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.email_confirmation.confirm': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.logout': { paramsTuple?: []; params?: {} }
    'app.account.show': { paramsTuple?: []; params?: {} }
    'app.account.update': { paramsTuple?: []; params?: {} }
    'app.account.password': { paramsTuple?: []; params?: {} }
    'app.account.confirmation': { paramsTuple?: []; params?: {} }
    'app.role_switch.show': { paramsTuple?: []; params?: {} }
    'app.role_switch.store': { paramsTuple?: []; params?: {} }
    'app.teachers.index': { paramsTuple?: []; params?: {} }
    'app.teachers.invite': { paramsTuple?: []; params?: {} }
    'app.teachers.resend': { paramsTuple: [ParamValue]; params: {'invitation': ParamValue} }
    'app.teachers.cancel': { paramsTuple: [ParamValue]; params: {'invitation': ParamValue} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.ai_demo.index': { paramsTuple?: []; params?: {} }
    'app.ai_demo.store': { paramsTuple?: []; params?: {} }
    'app.ai_demo.cancel': { paramsTuple: [ParamValue]; params: {'generation': ParamValue} }
    'app.ai_demo.retry': { paramsTuple: [ParamValue]; params: {'generation': ParamValue} }
    'public.announcements': { paramsTuple?: []; params?: {} }
    'public.announcement': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public.events': { paramsTuple?: []; params?: {} }
    'public.event': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public.stories': { paramsTuple?: []; params?: {} }
    'public.story': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public.terms': { paramsTuple?: []; params?: {} }
    'public.privacy': { paramsTuple?: []; params?: {} }
    'public.student_data': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.login.store': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
    'exam.logout': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'admin.school_directory.index': { paramsTuple?: []; params?: {} }
    'admin.school_directory.show': { paramsTuple: [ParamValue]; params: {'npsn': ParamValue} }
    'admin.region_changes.index': { paramsTuple?: []; params?: {} }
    'admin.schools.index': { paramsTuple?: []; params?: {} }
    'admin.schools.show': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.users.index': { paramsTuple?: []; params?: {} }
    'admin.settings.show': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.index': { paramsTuple?: []; params?: {} }
    'admin.calendar_console.index': { paramsTuple?: []; params?: {} }
    'admin.announcements.index': { paramsTuple?: []; params?: {} }
    'admin.announcements.create': { paramsTuple?: []; params?: {} }
    'admin.announcements.target_options': { paramsTuple?: []; params?: {} }
    'admin.announcements.edit': { paramsTuple: [ParamValue]; params: {'announcement': ParamValue} }
    'admin.events.index': { paramsTuple?: []; params?: {} }
    'admin.events.create': { paramsTuple?: []; params?: {} }
    'admin.events.edit': { paramsTuple: [ParamValue]; params: {'event': ParamValue} }
    'admin.stories.index': { paramsTuple?: []; params?: {} }
    'admin.stories.create': { paramsTuple?: []; params?: {} }
    'admin.stories.edit': { paramsTuple: [ParamValue]; params: {'story': ParamValue} }
    'admin.legal.index': { paramsTuple?: []; params?: {} }
    'admin.legal.edit': { paramsTuple: [ParamValue]; params: {'document': ParamValue} }
    'admin.staff.index': { paramsTuple?: []; params?: {} }
    'admin.staff.scope_options': { paramsTuple?: []; params?: {} }
    'admin.staff.show': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.activity_log.index': { paramsTuple?: []; params?: {} }
    'admin.access_matrix.index': { paramsTuple?: []; params?: {} }
    'admin.staff_password.edit': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.index': { paramsTuple?: []; params?: {} }
    'app.layer_packages.index': { paramsTuple?: []; params?: {} }
    'app.layer_proposals.index': { paramsTuple?: []; params?: {} }
    'app.academic_years.index': { paramsTuple?: []; params?: {} }
    'app.academic_years.edit': { paramsTuple: [ParamValue]; params: {'academicYear': ParamValue} }
    'app.classes.index': { paramsTuple?: []; params?: {} }
    'app.classes.show': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.timetable.index': { paramsTuple?: []; params?: {} }
    'app.timetable.compose': { paramsTuple?: []; params?: {} }
    'app.timetable.drafts.show': { paramsTuple: [ParamValue]; params: {'draft': ParamValue} }
    'app.timetable.class.show': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.timetable.mine': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'app.announcements.index': { paramsTuple?: []; params?: {} }
    'app.announcements.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'app.login': { paramsTuple?: []; params?: {} }
    'app.password.forgot': { paramsTuple?: []; params?: {} }
    'app.password.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.sign_up': { paramsTuple?: []; params?: {} }
    'app.invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.email_confirmation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.account.show': { paramsTuple?: []; params?: {} }
    'app.role_switch.show': { paramsTuple?: []; params?: {} }
    'app.teachers.index': { paramsTuple?: []; params?: {} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.ai_demo.index': { paramsTuple?: []; params?: {} }
    'public.announcements': { paramsTuple?: []; params?: {} }
    'public.announcement': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public.events': { paramsTuple?: []; params?: {} }
    'public.event': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public.stories': { paramsTuple?: []; params?: {} }
    'public.story': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public.terms': { paramsTuple?: []; params?: {} }
    'public.privacy': { paramsTuple?: []; params?: {} }
    'public.student_data': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'admin.school_directory.index': { paramsTuple?: []; params?: {} }
    'admin.school_directory.show': { paramsTuple: [ParamValue]; params: {'npsn': ParamValue} }
    'admin.region_changes.index': { paramsTuple?: []; params?: {} }
    'admin.schools.index': { paramsTuple?: []; params?: {} }
    'admin.schools.show': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.users.index': { paramsTuple?: []; params?: {} }
    'admin.settings.show': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.index': { paramsTuple?: []; params?: {} }
    'admin.calendar_console.index': { paramsTuple?: []; params?: {} }
    'admin.announcements.index': { paramsTuple?: []; params?: {} }
    'admin.announcements.create': { paramsTuple?: []; params?: {} }
    'admin.announcements.target_options': { paramsTuple?: []; params?: {} }
    'admin.announcements.edit': { paramsTuple: [ParamValue]; params: {'announcement': ParamValue} }
    'admin.events.index': { paramsTuple?: []; params?: {} }
    'admin.events.create': { paramsTuple?: []; params?: {} }
    'admin.events.edit': { paramsTuple: [ParamValue]; params: {'event': ParamValue} }
    'admin.stories.index': { paramsTuple?: []; params?: {} }
    'admin.stories.create': { paramsTuple?: []; params?: {} }
    'admin.stories.edit': { paramsTuple: [ParamValue]; params: {'story': ParamValue} }
    'admin.legal.index': { paramsTuple?: []; params?: {} }
    'admin.legal.edit': { paramsTuple: [ParamValue]; params: {'document': ParamValue} }
    'admin.staff.index': { paramsTuple?: []; params?: {} }
    'admin.staff.scope_options': { paramsTuple?: []; params?: {} }
    'admin.staff.show': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.activity_log.index': { paramsTuple?: []; params?: {} }
    'admin.access_matrix.index': { paramsTuple?: []; params?: {} }
    'admin.staff_password.edit': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.home': { paramsTuple?: []; params?: {} }
    'app.extracurriculars.index': { paramsTuple?: []; params?: {} }
    'app.layer_packages.index': { paramsTuple?: []; params?: {} }
    'app.layer_proposals.index': { paramsTuple?: []; params?: {} }
    'app.academic_years.index': { paramsTuple?: []; params?: {} }
    'app.academic_years.edit': { paramsTuple: [ParamValue]; params: {'academicYear': ParamValue} }
    'app.classes.index': { paramsTuple?: []; params?: {} }
    'app.classes.show': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.timetable.index': { paramsTuple?: []; params?: {} }
    'app.timetable.compose': { paramsTuple?: []; params?: {} }
    'app.timetable.drafts.show': { paramsTuple: [ParamValue]; params: {'draft': ParamValue} }
    'app.timetable.class.show': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.timetable.mine': { paramsTuple?: []; params?: {} }
    'app.calendar.index': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'app.announcements.index': { paramsTuple?: []; params?: {} }
    'app.announcements.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'app.login': { paramsTuple?: []; params?: {} }
    'app.password.forgot': { paramsTuple?: []; params?: {} }
    'app.password.reset': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.sign_up': { paramsTuple?: []; params?: {} }
    'app.invitations.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.email_confirmation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.account.show': { paramsTuple?: []; params?: {} }
    'app.role_switch.show': { paramsTuple?: []; params?: {} }
    'app.teachers.index': { paramsTuple?: []; params?: {} }
    'app.home': { paramsTuple?: []; params?: {} }
    'app.ai_demo.index': { paramsTuple?: []; params?: {} }
    'public.announcements': { paramsTuple?: []; params?: {} }
    'public.announcement': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public.events': { paramsTuple?: []; params?: {} }
    'public.event': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public.stories': { paramsTuple?: []; params?: {} }
    'public.story': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'public.terms': { paramsTuple?: []; params?: {} }
    'public.privacy': { paramsTuple?: []; params?: {} }
    'public.student_data': { paramsTuple?: []; params?: {} }
    'exam.login': { paramsTuple?: []; params?: {} }
    'exam.home': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'admin.region_changes.accept': { paramsTuple: [ParamValue]; params: {'review': ParamValue} }
    'admin.region_changes.reject': { paramsTuple: [ParamValue]; params: {'review': ParamValue} }
    'admin.schools.invite': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.schools.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'school': ParamValue,'invitation': ParamValue} }
    'admin.schools.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'school': ParamValue,'invitation': ParamValue} }
    'admin.schools.trial': { paramsTuple: [ParamValue]; params: {'school': ParamValue} }
    'admin.users.trial': { paramsTuple: [ParamValue]; params: {'user': ParamValue} }
    'admin.settings.update': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.store': { paramsTuple?: []; params?: {} }
    'admin.area_proposals.approve': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.return': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.reject': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.resubmit': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.area_proposals.withdraw': { paramsTuple: [ParamValue]; params: {'proposal': ParamValue} }
    'admin.calendar_console.import': { paramsTuple?: []; params?: {} }
    'admin.calendar_console.activate': { paramsTuple: [ParamValue]; params: {'package': ParamValue} }
    'admin.announcements.store': { paramsTuple?: []; params?: {} }
    'admin.announcements.update': { paramsTuple: [ParamValue]; params: {'announcement': ParamValue} }
    'admin.announcements.unpublish': { paramsTuple: [ParamValue]; params: {'announcement': ParamValue} }
    'admin.announcements.destroy': { paramsTuple: [ParamValue]; params: {'announcement': ParamValue} }
    'admin.events.store': { paramsTuple?: []; params?: {} }
    'admin.events.update': { paramsTuple: [ParamValue]; params: {'event': ParamValue} }
    'admin.events.unpublish': { paramsTuple: [ParamValue]; params: {'event': ParamValue} }
    'admin.events.destroy': { paramsTuple: [ParamValue]; params: {'event': ParamValue} }
    'admin.stories.store': { paramsTuple?: []; params?: {} }
    'admin.stories.update': { paramsTuple: [ParamValue]; params: {'story': ParamValue} }
    'admin.stories.unpublish': { paramsTuple: [ParamValue]; params: {'story': ParamValue} }
    'admin.stories.destroy': { paramsTuple: [ParamValue]; params: {'story': ParamValue} }
    'admin.legal.start': { paramsTuple: [ParamValue]; params: {'key': ParamValue} }
    'admin.legal.update': { paramsTuple: [ParamValue]; params: {'document': ParamValue} }
    'admin.legal.publish': { paramsTuple: [ParamValue]; params: {'document': ParamValue} }
    'admin.legal.destroy': { paramsTuple: [ParamValue]; params: {'document': ParamValue} }
    'admin.staff.store': { paramsTuple?: []; params?: {} }
    'admin.staff.grant': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.staff.scope': { paramsTuple: [ParamValue,ParamValue]; params: {'staff': ParamValue,'role': ParamValue} }
    'admin.staff.revoke': { paramsTuple: [ParamValue,ParamValue]; params: {'staff': ParamValue,'role': ParamValue} }
    'admin.staff.disable': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.staff.enable': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.staff.resend_link': { paramsTuple: [ParamValue]; params: {'staff': ParamValue} }
    'admin.staff_password.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
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
    'app.academic_years.store': { paramsTuple?: []; params?: {} }
    'app.academic_years.update': { paramsTuple: [ParamValue]; params: {'academicYear': ParamValue} }
    'app.academic_years.destroy': { paramsTuple: [ParamValue]; params: {'academicYear': ParamValue} }
    'app.academic_years.copy_classes': { paramsTuple: [ParamValue]; params: {'academicYear': ParamValue} }
    'app.classes.store': { paramsTuple?: []; params?: {} }
    'app.classes.update': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.classes.destroy': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.classes.assign': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.timetable.settings': { paramsTuple?: []; params?: {} }
    'app.timetable.drafts.store': { paramsTuple?: []; params?: {} }
    'app.timetable.drafts.reshuffle': { paramsTuple: [ParamValue]; params: {'draft': ParamValue} }
    'app.timetable.drafts.save': { paramsTuple: [ParamValue]; params: {'draft': ParamValue} }
    'app.timetable.class.store': { paramsTuple: [ParamValue]; params: {'class': ParamValue} }
    'app.timetable.class.update': { paramsTuple: [ParamValue,ParamValue]; params: {'class': ParamValue,'slot': ParamValue} }
    'app.timetable.class.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'class': ParamValue,'slot': ParamValue} }
    'app.timetable.class.lock': { paramsTuple: [ParamValue,ParamValue]; params: {'class': ParamValue,'slot': ParamValue} }
    'app.calendar.store': { paramsTuple?: []; params?: {} }
    'app.calendar.update': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.calendar.destroy': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.calendar.hide': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.calendar.unhide': { paramsTuple: [ParamValue]; params: {'item': ParamValue} }
    'app.calendar.propose': { paramsTuple?: []; params?: {} }
    'app.calendar.acknowledge': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'app.announcements.read_all': { paramsTuple?: []; params?: {} }
    'app.login.store': { paramsTuple?: []; params?: {} }
    'app.password.email': { paramsTuple?: []; params?: {} }
    'app.password.update': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.sign_up.store': { paramsTuple?: []; params?: {} }
    'app.invitations.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.email_confirmation.confirm': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'app.logout': { paramsTuple?: []; params?: {} }
    'app.account.update': { paramsTuple?: []; params?: {} }
    'app.account.password': { paramsTuple?: []; params?: {} }
    'app.account.confirmation': { paramsTuple?: []; params?: {} }
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