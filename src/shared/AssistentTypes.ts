export interface AssistentJournal {
  id: number
  name: string
  entriesInTimetable: AssistentTimetableEntry[]
  entriesInJournal: AssistentJournalEntry[]
  exercisesLists: AssistentExerciseListEntry[]
  differencesToTimetable: AssistentJournalDifference[]
  students: AssistentStudent[]
  learningOutcomes: AssistentLearningOutcomes[]
  studentsMissingIndependentWork: AssistentStudentsWithoutIndependentWork[]
  missingGrades: AssistentStudentsWithoutGrades[]
  independentWorkPlanned: number
  independentWorkGiven: number
  contactLessonsPlanned: number
  contactLessonsGiven: number
  gradingType: AssistentGradingType
  lessonMissing: boolean
  lessonDiscrepancies: boolean
}

export enum AssistentGradingType {
    numeric = 'numeric',
    passFail = 'passFail',
}

export interface AssistentStudent {
    id: number;
    studentId: number;
    name: string;
    status: AssistentStudentStatus;
}

export enum AssistentStudentStatus {
    active = 'active',
    academicLeave = 'academicLeave',
    exmatriculated = "exmatriculated",
    individualCurriculum = "individualCurriculum",
    finished = "finished"
}

export interface AssistentJournalDifference {
    date: string;
    lessonType: LessonType;
    timetableLessonCount: number;
    timetableFirstLessonStartNumber: number;
    journalLessonCount: number;
    journalFirstLessonStartNumber: number;
    journalEntryId: number;
}

export interface AssistentExerciseListEntry {
  id: number
  entryDate: string
  learningOutcomes: number[]
  content: string
  lessonType: LessonType
  homeworkDuedate: string
}

export interface AssistentTimetableEntry {
  id: number
  name: string
  date: string
  timeStart: string
  timeEnd: string
  firstLessonStartNumber: number
  journalId: number
}

export interface AssistentJournalEntry {
    id: number;
    date: string;
    name: string;
    lessonType: LessonType
    lessonCount: number;
    firstLessonStartNumber: number;
    journalStudentResults: AssistentStudentEntryResults[];
}

export interface AssistentLessonTime {
    number: number;
    timeStart: string;
    timeEnd: string;
    note?: string;
}


export enum LessonType {
    independentWork = 'independentWork',
    lesson = 'lesson',
    other = 'other'
}

export interface AssistentLearningOutcomes {
    curriculumModuleOutcomes: number,
    name: string,
    code?: string,
    studentOutcomeResults?: AssistentStudentOutcomeResults[]
}

export interface AssistentStudentOutcomeResults {
    id: number
    studentId: number
    gradeNumber: number
}

export interface AssistentStudentEntryResults {
    studentId: number;
    gradeCode: string;
    gradeNumber?: number;
}

export interface AssistentStudentsWithoutGrades {
    curriculumModuleOutcomes: number,
    name: string,
    code: string,
    studentList: AssistentStudent[]
}

export interface AssistentStudentsWithoutIndependentWork {
  studentId: number
  name: string
  exerciseList: AssistentExerciseListEntry[]
}

