import { DateTime } from 'luxon';
import Api from "~src/shared/AssistentApiClient";
import AssistentApiClient from "~src/shared/AssistentApiClient";
import AssistentCache from "~src/shared/AssistentCache";
import { AssistentDetailedError } from "~src/shared/AssistentDetailedError";
import AssistentDom from "~src/shared/AssistentDom";
import { type AssistentExerciseListEntry, type AssistentJournal, type AssistentJournalDifference, type AssistentJournalEntry, type AssistentLearningOutcomes, LessonType } from "~src/shared/AssistentTypes";
import TahvelDom from "./TahvelDom";
import { type apiCurriculumModuleEntry, type apiExercisesListEntry, type apiJournalEntry, type apiStudentOutcomeEntry } from "./TahvelTypes";


class TahvelJournal {
  // eslint-disable-next-line
  static async findJournalEntryElement(discrepancy: any
  ): Promise<HTMLElement | null> {
    // Extract and format the discrepancy date as 'dd.mm'
    const discrepancyDate = new Date(discrepancy.date)
    const day = discrepancyDate.getUTCDate().toString().padStart(2, "0")
    const month = (discrepancyDate.getUTCMonth() + 1)
      .toString()
      .padStart(2, "0")
    const formattedDate = `${day}.${month}`

    // Find the table header containing the formatted date and no 'Iseseisev töö' div
    const th = Array.from(
      document.querySelectorAll("table.journalTable th")
    ).find((th) => {
      const hasTheDate = Array.from(th.querySelectorAll("span")).some((span) =>
        span.textContent.includes(formattedDate)
      )
      const isNotIndependentWork = !th.querySelector(
        'div[aria-label*="Iseseisev töö"]'
      )
      return hasTheDate && isNotIndependentWork
    })

    // Extract and return the target span element if found, otherwise return null
    const targetSpan = th?.querySelector(
      "span[ng-if=\"journalEntry.entryType.code !== 'SISSEKANNE_L'\"]"
    ) as HTMLElement
    return targetSpan || null
  }

  static async getJournalWithValidation(): Promise<AssistentJournal | null> {
    const journalId = parseInt(window.location.href.split("/")[5])

    if (!journalId) {
      throw new AssistentDetailedError(
        500,
        "Error",
        "Journal ID not found in URL"
      )
    }
    const journal = AssistentCache.getJournal(journalId)
    if (!journal) {
      throw new AssistentDetailedError(
        500,
        "Error",
        "Journal data not found in cache"
      )
    }

    return journal
  }

  static async addLessonDiscrepanciesTable() {
    const journalHeaderElement = document.querySelector(
      ".ois-form-layout-padding"
    ) as HTMLElement

    if (!journalHeaderElement) {
      throw new AssistentDetailedError(
        500,
        "Error",
        "Journal header element not found"
      )
    }

    const journal = await TahvelJournal.getJournalWithValidation()
    if (!journal) {
      return
    }

    if (journal.differencesToTimetable.length) {
      const sortedDiscrepancies = journal.differencesToTimetable.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      // Create a skeleton for the table
      const lessonDiscrepanciesTable = AssistentDom.createStructure(`
                <table id="assistent-discrepancies-table" class="assistent-table">
                    <caption>Ebakõlad võrreldes tunniplaaniga</caption>
                    <thead>
                    <tr>
                        <th rowspan="2">Kuupäev</th>
                        <th>Algustund</th>
                        <th>Tundide arv</th>
                        <th rowspan="2">Tegevus</th>
                    </tr>
                    </thead>
                    <tbody>
                    </tbody>
                </table>`)

      journalHeaderElement.appendChild(lessonDiscrepanciesTable)

      // Wait for the first <td> element to be visible
      try {
        await AssistentDom.waitForElement("table.journalTable tbody tr td")
      } catch (e) {
        throw new AssistentDetailedError(
          500,
          "Error",
          "Journal table not found"
        )
      }

      // Iterate over the discrepancies and create a row with the appropriate action button
      for (const discrepancy of sortedDiscrepancies) {
        const dateText = DateTime.fromISO(discrepancy.date).toFormat(
          "dd.LL.yyyy"
        )

        let startLessonText: string | number
        if (
          discrepancy.journalFirstLessonStartNumber === 0 ||
          discrepancy.journalFirstLessonStartNumber ===
            discrepancy.timetableFirstLessonStartNumber
        ) {
          startLessonText = discrepancy.timetableFirstLessonStartNumber
        } else {
          startLessonText = `<del>${discrepancy.journalFirstLessonStartNumber}</del><ins>${discrepancy.timetableFirstLessonStartNumber}</ins>`
        }

        let lessonCountText: string | number
        if (
          discrepancy.journalLessonCount === 0 ||
          discrepancy.journalLessonCount === discrepancy.timetableLessonCount
        ) {
          lessonCountText = discrepancy.timetableLessonCount
        } else {
          lessonCountText = `<del>${discrepancy.journalLessonCount}</del><ins>${discrepancy.timetableLessonCount}</ins>`
        }

        const button =
          await TahvelJournal.createActionButtonForLessonDiscrepancyAction(
            discrepancy
          )

        // Create a row for the table
        const tr = AssistentDom.createStructure(`
                    <tr>
                        <td>${dateText}</td>
                        <td>${startLessonText}</td>
                        <td>${lessonCountText}</td>
                        <td></td>
                    </tr>`)

        // Append the button to the last cell in the row
        tr.querySelector("td:last-child").appendChild(button)

        // Append the row to the table body
        lessonDiscrepanciesTable.querySelector("tbody").appendChild(tr)
      }
    }
    // Mark that lesson discrepancies table has been injected
    journalHeaderElement.dataset.lessonDiscrepanciesTableIsInjected = "true"
  }

  static async addMissingGradesTable() {
    const journalHeaderElement = document.querySelector(
        'div[ng-if="journal.hasJournalStudents"]'
    );
    if (
        !journalHeaderElement ||
        journalHeaderElement.getAttribute("data-lesson-discrepancies-table-is-injected") === "true"
    )
      return;

    const journal = await TahvelJournal.getJournalWithValidation();
    if (
        !journal ||
        journal.missingGrades.length === 0 ||
        journal.contactLessonsPlanned > journal.entriesInTimetable.length
    )
      return;

    const gradingType = journal.gradingType;
    const isNumeric = gradingType === "numeric";

    const missingGradesTable = AssistentDom.createStructure(`
      <div id="assistent-grades-table-container">
          <table id="assistent-grades-table" class="assistent-table">
              <caption>Puuduvad hinded</caption>
              <thead>
                  <tr>
                      <th>Õpiväljund</th>
                      <th>Hindeta õpilased</th>
                      <th>Tegevus</th>
                  </tr>
              </thead>
              <tbody>
                  ${journal.missingGrades
        .map(({ name, code, studentList }) => {
          // Check if there is any independent work that should disable the button
          const shouldDisableButton = journal.studentsMissingIndependentWork.some(
              (student) =>
                  student.exerciseList.some((exercise) =>
                      exercise.learningOutcomes.includes(parseInt(code, 10))
                  )
          );

          const tooltipMessage = `On vaja määrata hinded ÕV${code} jaoks`;

          return `
                              <tr>
                                  <td class="align-left">${name}</td>
                                  <td class="align-left">${studentList
              .map(({ name }) => name)
              .join(", ")}</td>
                                  <td>
                                      <button class="md-raised md-button md-ink-ripple md-primary" 
                                          ${shouldDisableButton ? `disabled` : ""}
                                          ${shouldDisableButton ? `data-tooltip="${tooltipMessage}"` : ""}>
                                          ${studentList.length > 1 ? "Lisa hindeid" : "Lisa hinne"}
                                      </button>
                                  </td>
                              </tr>`;
        })
        .join("")}
                  <tr>
                      <td colspan="3" class="align-left">
                          <input type="radio" id="passFail" name="grading" value="Mitteeristav hindamine" ${!isNumeric ? "checked" : ""}>
                          <label for="passFail">Mitteeristav hindamine${!isNumeric ? " (vaikimisi)" : ""}</label>
                          <br>
                          <input type="radio" id="numeric" name="grading" value="Eristav hindamine" ${isNumeric ? "checked" : ""}>
                          <label for="numeric">Eristav hindamine${isNumeric ? " (vaikimisi)" : ""}</label>
                          <br>
                      </td>
                  </tr>
              </tbody>
          </table>
      </div>`);

    journalHeaderElement.before(missingGradesTable);

    // Initialize tooltips for disabled buttons
    document.querySelectorAll('button[disabled][data-tooltip]').forEach(button => {
      button.addEventListener('mouseover', function() {
        const tooltipText = this.getAttribute('data-tooltip');
        const tooltipElement = document.createElement('div');
        tooltipElement.className = 'custom-tooltip';
        tooltipElement.innerText = tooltipText;
        document.body.appendChild(tooltipElement);

        const rect = this.getBoundingClientRect();
        tooltipElement.style.left = `${rect.left + window.scrollX}px`;
        tooltipElement.style.top = `${rect.top + window.scrollY - tooltipElement.offsetHeight - 5}px`;

        this.addEventListener('mouseleave', function() {
          document.body.removeChild(tooltipElement);
        });
      });
    });

    // Mark that missing grades table has been injected
    document.querySelectorAll("#assistent-grades-table button.md-primary")
        .forEach((button, index) => {
          button.addEventListener("click", async () => {
            TahvelJournal.setGradeInputAsSelectToFalse();
            const gradingType = document.querySelector('input[name="grading"]:checked').id;

            const code = parseInt(journal.missingGrades[index].code, 10);
            TahvelJournal.clickQuickUpdate(`${code}`);

            for (const student of journal.missingGrades[index].studentList) {
              try {
                const studentGrades = TahvelJournal.getAllGradesForStudent(
                    journal.entriesInJournal,
                    student.id,
                    gradingType,
                    code
                );
                const grade = TahvelJournal.calculateGrade(
                    gradingType,
                    studentGrades
                );

                TahvelJournal.setGradeForStudent(student.studentId, grade.toString());
                TahvelJournal.setDateForStudentGrade(student.studentId, new Date());

                if ((typeof grade == "number" && grade > 3) || grade === "MA") {
                  TahvelJournal.setCommentForStudentGrade(student.studentId, "Grade was negative due to...");
                }
              } catch (error) {
                console.error(`Error setting grade for student ${student.studentId}:`, error);
              }
            }

            TahvelJournal.saveGradesForOutcome(journal.missingGrades[index].code);
          });
        });
  }

  static async addMissingIndependentWorksTable() {
    const journalHeaderElement = document.querySelector(
      'div[ng-if="journal.hasJournalStudents"]'
    )
    if (
      !journalHeaderElement ||
      journalHeaderElement.getAttribute(
        "data-lesson-discrepancies-table-is-injected"
      ) === "true"
    )
      return

    const journal = await TahvelJournal.getJournalWithValidation()
    if (!journal || journal.studentsMissingIndependentWork.length === 0) return

    // Create the table structure
    const missingIndependentWorksTable = AssistentDom.createStructure(`
  <div>
      <div id="assistent-grades-table-container">
          <table id="assistent-independent-works-table" class="assistent-table">
              <caption>Sisse kandmata iseseisvad tööd</caption>
              <thead>
                  <tr>
                      <th>Tähtaeg</th>
                      <th>Iseseisev töö nimetus</th>
                      <th>Õpiväljund</th>
                      <th>Õpilane</th>
                      <th>Tegevus</th>
                      <th>Komentaar</th>
                  </tr>
              </thead>
              <tbody>
                  ${journal.studentsMissingIndependentWork
                    .map(({ name, exerciseList, studentId }) =>
                      exerciseList
                        .map((exercise) => {
                          // Map the learning outcomes to the "ÕV" prefix and join them into a string
                          const learningOutcomes = exercise.learningOutcomes
                            .map((lo) => `ÕV${lo}`)
                            .join(", ")

                          return `
                  <tr>
                      <td class="align-left">${exercise.homeworkDuedate}</td>
                      <td class="align-left">${exercise.content}</td>
                      <td class="align-left">${learningOutcomes}</td>     
                      <td class="align-left">${name}</td>
                      <td class="align-left">
                          <div class="grade-buttons">
                              ${[5, 4, 3, 2, "A", "MA"]
                                .map(
                                  (grade) => `
                                    <button class="grade-btn" data-grade="${grade}" data-student="${studentId}" data-exercise="${exercise.id}">
                                        ${grade}
                                    </button>
                                `
                                )
                                .join("")}
                          </div>
                      </td>
                      <td><input type="text" class="comment-input" placeholder="Kommentaar" data-student="${studentId}" data-exercise="${
                            exercise.id
                          }" /></td>
                  </tr>
              `
                        })
                        .join("")
                    )
                    .join("")}
              </tbody>
              <tfoot>
                  <tr>
                      <td colspan="6" class="align-left">
                          <button id="save-grades-btn" class="md-raised md-button md-ink-ripple md-primary">Salvesta</button>
                      </td>
                  </tr>
              </tfoot>
          </table>
      </div>
  </div>`)

    // Add the table to the DOM
    journalHeaderElement.before(missingIndependentWorksTable)

    // eslint-disable-next-line
    const selectedGrades = new Map<number, any>()

    document.querySelectorAll(".grade-buttons").forEach((buttonGroup) => {
      buttonGroup.addEventListener("click", function (event) {
        const target = event.target as HTMLElement

        if (!target.classList.contains("grade-btn")) return

        const btn = target as HTMLButtonElement
        const studentId = Number(btn.getAttribute("data-student"))
        const exerciseId = Number(btn.getAttribute("data-exercise"))
        const grade = btn.getAttribute("data-grade")

        const isSelected = btn.classList.contains("selected")

        // Deselect all buttons in the current row
        buttonGroup.querySelectorAll(".grade-btn").forEach((button) => {
          button.classList.remove("selected")
        })

        if (!isSelected) {
          // If not previously selected, select this button
          btn.classList.add("selected")

          // Add or update the selected grade
          const existingEntries = selectedGrades.get(exerciseId) || []
          const newEntry = {
            journalStudent: studentId,
            grade: {
              code: `KUTSEHINDAMINE_${grade}`,
              value: grade.toString(),
              value2: grade.toString()
            },
            isLessonAbsence: false,
            lessonAbsences: {},
            addInfo: (
              document.querySelector(
                `.comment-input[data-student="${studentId}"][data-exercise="${exerciseId}"]`
              ) as HTMLInputElement
            ).value
          }

          // Replace or add the entry for this student
          const updatedEntries = existingEntries.filter(
            (entry) => entry.journalStudent !== studentId
          )
          updatedEntries.push(newEntry)
          selectedGrades.set(exerciseId, updatedEntries)
        } else {
          // If already selected, deselect and remove the grade
          selectedGrades.delete(exerciseId)
        }
      })
    })

    // Handle the "Salvesta" button click
    document
      .getElementById("save-grades-btn")
      .addEventListener("click", async () => {
        const savePromises = []

        for (const [exerciseId, studentEntries] of selectedGrades.entries()) {
          const savePromise = (async () => {
            try {
              // Fetch the existing journal entry
              const existingEntry = await TahvelJournal.fetchJournalEntry(
                journal.id,
                exerciseId
              )

              // Filter out any student entries that are already present in existingEntry.journalEntryStudents
              const updatedExistingEntries =
                existingEntry.journalEntryStudents.filter(
                  (existingStudentEntry) => {
                    // Find the corresponding new entry
                    const newStudentEntry = studentEntries.find(
                      (newEntry) =>
                        newEntry.journalStudent ===
                        existingStudentEntry.journalStudent
                    )

                    if (newStudentEntry) {
                      // If it exists, update the existing entry with the new data
                      newStudentEntry.id = existingStudentEntry.id // Keep the original ID
                      return false // Remove this entry from the existing entries
                    }

                    return true // Keep this entry if no corresponding new entry exists
                  }
                )

              // Combine the filtered existing entries with the new ones
              existingEntry.journalEntryStudents = [
                ...updatedExistingEntries,
                ...studentEntries
              ]

              // Send the updated journal entry
              await AssistentApiClient.put(
                `/journals/${journal.id}/journalEntry/${exerciseId}`,
                existingEntry
              )
              console.log(
                `Successfully saved grades and comments for exercise ${exerciseId}`
              )
            } catch (error) {
              console.error(
                `Failed to save grades and comments for exercise ${exerciseId}`,
                error
              )
            }
          })()

          savePromises.push(savePromise)
        }

        // Wait for all the save operations to complete
        await Promise.all(savePromises)

        // Reload the page after all data has been saved
        window.location.reload()
      })
  }

  static getAllGradesForStudent(
      entriesInJournal: AssistentJournalEntry[],
      studentId: number,
      gradingType: string,
      learningOutcomeCode: number
  ): number[] {
    const grades: number[] = [];

    for (const journalEntry of entriesInJournal) {
      // Ensure that journalEntry.name is not null or undefined before calling match
      if (!journalEntry.name) {
        continue; // Skip this journal entry if name is null or undefined
      }

      // Extract the ÕV codes from the journalEntry name
      const learningOutcomeMatches = journalEntry.name.match(/ÕV(\d+)/g);
      const learningOutcomes = learningOutcomeMatches
          ? learningOutcomeMatches.map((match) => parseInt(match.replace("ÕV", ""), 10))
          : [];

      // Check if any of the ÕV codes match the provided learningOutcomeCode
      if (!learningOutcomes.includes(learningOutcomeCode)) {
        continue; // Skip this journal entry if there is no match
      }
      const studentResults = journalEntry.journalStudentResults
          .filter(
              (result) => result.studentId === studentId && result.gradeNumber > 0
          )
          .map((result) => result.gradeNumber);

      // if (
      //     journalEntry.lessonType === LessonType.independentWork &&
      //     studentResults.length === 0
      // ) {
      //   if (gradingType !== "numeric") {
      //     return [2];
      //   } else {
      //     studentResults.push(2);
      //   }
      // }

      grades.push(...studentResults);
    }
    return grades;
  }

  static calculateGrade(
    gradingType: string,
    grades: number[]
  ): string | number {
    if (grades.length === 0 || grades.length === 1) {
      return gradingType === "numeric" ? 2 : "MA"
    }

    const sum = grades.reduce((acc, grade) => acc + grade, 0)
    const averageGrade = sum / grades.length

    if (gradingType === "numeric") {
      return Math.round(averageGrade)
    } else {
      return averageGrade >= 2.5 ? "A" : "MA"
    }
  }

  static setGradeForStudent(id: number, grade: string) {
    // find <tr> where a href contains student id
    const tr = TahvelJournal.findTableRowById(id)

    // add grade to corresponding input
    const gradeInput = tr?.querySelector(
      'input[aria-label="grade"]'
    ) as HTMLInputElement
    gradeInput.value = grade
    // add green border to input
    gradeInput.style.border = "2px solid #40ff6d"
    const inputEvent = new Event("input", { bubbles: true })
    gradeInput.dispatchEvent(inputEvent)
  }

  static setDateForStudentGrade(id: number, date: Date) {
    // find tr where a href contains student id
    const tr = TahvelJournal.findTableRowById(id)

    // add Date to corresponding dateInput
    const dateInput = tr?.querySelector(
      'input[aria-label="grade date"]'
    ) as HTMLInputElement
    dateInput.value = DateTime.fromJSDate(date).toFormat("dd.LL.yyyy")
    // add green border to input
    dateInput.style.border = "2px solid #40ff6d"
    const inputEvent = new Event("input", { bubbles: true })
    dateInput.dispatchEvent(inputEvent)
  }

  static setCommentForStudentGrade(id: number, gradeWasNegativeDueTo: string) {
    // find tr where a href contains student id
    const tr = TahvelJournal.findTableRowById(id)

    const commentInput = tr?.querySelector(
      'input[ng-model="journalEntry.quickUpdateStudents[row.studentId].addInfo"]'
    ) as HTMLInputElement
    // const commentInput = document.querySelector('input[ng-model="journalEntry.quickUpdateStudents[row.studentId].addInfo"]') as HTMLTextAreaElement;
    commentInput.value = gradeWasNegativeDueTo
    // add green border to input
    commentInput.style.border = "2px solid #40ff6d"
    const inputEvent = new Event("input", { bubbles: true })
    commentInput.dispatchEvent(inputEvent)
  }

  static saveGradesForOutcome(code: string) {
    console.log("Saving grades for outcome", code)
    const saveButton = document.querySelector(
      'button[ng-click="saveQuickOutcomeUpdate(journalEntry)"]'
    ) as HTMLElement
    saveButton.click()
  }

  static findTableRowById(id: number): HTMLTableRowElement | null {
    return Array.from(document.querySelectorAll("tr")).find((tr) => {
      const a = tr.querySelector("a")
      if (!a) return false
      const idRegex = new RegExp(`/students/${id}/main$`)
      return idRegex.test(a.getAttribute("href"))
    })
  }

  // Function to find elements by exact text content
  static clickQuickUpdate(learningOutcome) {
    // TODO: add english language support
    const spans = Array.from(document.querySelectorAll("span")).filter(
      (el) => el.innerHTML.trim() === "ÕV" + learningOutcome
    )
    if (spans.length !== 1) {
      throw new AssistentDetailedError(
        500,
        "Error",
        "Could not find the learning outcome"
      )
    }
    const thElement = spans[0]?.closest("th") // Get the parent <th> element
    if (!thElement) {
      throw new AssistentDetailedError(
        500,
        "Error",
        "Could not find the parent <th> element"
      )
    }

    const mdIconElement = thElement.querySelector("md-icon") as HTMLElement // Find the md-icon element
    if (!mdIconElement) {
      throw new AssistentDetailedError(
        500,
        "Error",
        "Could not find the md-icon element"
      )
    }
    // click the md-icon element
    mdIconElement.click()
  }

  static getLearningOutcomesArray(): AssistentLearningOutcomes[] {
    const learningOutcomes = Array.from(
      document.querySelectorAll(
        'div[ng-if="journal.includesOutcomes"] tbody tr'
      )
    ).map((tr) => ({
      name: tr.querySelector("td:nth-child(4)")!.textContent!,
      code: tr.querySelector("td:nth-child(3)")!.textContent!
    }))
    console.log("learningOutcomes", learningOutcomes)
    if (learningOutcomes.length === 0) return learningOutcomes
    TahvelJournal.removeGroupNameIfAllOutcomesAreForTheSameGroup(learningOutcomes)
    return learningOutcomes
  }

  private static removeGroupNameIfAllOutcomesAreForTheSameGroup(
    outcomes: AssistentLearningOutcomes[]
  ) {
    const getGroupName = (name: string) =>
      (name.match(/\(([^)]+)\)/g) || []).slice(-1)[0]?.slice(1, -1) || ""
    const firstGroupName = getGroupName(outcomes[0].name)
    if (outcomes.every(({ name }) => getGroupName(name) === firstGroupName)) {
      outcomes.forEach(
        (outcome) =>
          (outcome.name = outcome.name.replace(/\s*\([^)]*\)\s*$/, "").trim())
      )
    }
    console.log("outcomes", outcomes)
  }

  static async setJournalEntryStartLessonNr(
    discrepancy: AssistentJournalDifference
  ): Promise<void> {
    // Select the start lesson number from the dropdown
    await TahvelDom.selectDropdownOption(
      "journalEntry.startLessonNr",
      discrepancy.timetableFirstLessonStartNumber.toString()
    )

    // Create a style element
    const style = TahvelDom.createBlinkStyle()

    // Append the style element to the document head
    document.head.append(style)

    // Find the save button and add a red border to it
    const saveButton = (await AssistentDom.waitForElement(
      'button[ng-click="saveEntry()"]'
    )) as HTMLElement
    if (saveButton) {
      saveButton.classList.add("blink")
    }

    saveButton.addEventListener("click", () => {
      console.log("saveButton clicked")
      TahvelJournal.handleSaveButtonClick(discrepancy)
      window.location.reload()
    })
  }

  static async setJournalEntryCountOfLessons(
    discrepancy: AssistentJournalDifference
  ): Promise<void> {
    const timetableLessons = discrepancy.timetableLessonCount

    // Fill the number of lessons
    await TahvelDom.fillTextbox(
      'input[name="lessons"]',
      timetableLessons.toString()
    )

    // Create a style element
    const style = TahvelDom.createBlinkStyle()

    // Append the style element to the document head
    document.head.append(style)

    // Find the save button and add a red border to it
    const saveButton = (await AssistentDom.waitForElement(
      'button[ng-click="saveEntry()"]'
    )) as HTMLElement
    if (saveButton) {
      saveButton.classList.add("blink")
    }

    saveButton.addEventListener("click", () => {
      console.log("saveButton clicked")
      TahvelJournal.handleSaveButtonClick(discrepancy)
      window.location.reload()
    })

    // saveButton.addEventListener('click', () => {
    //     // convert discrepancy.date to dd.mm.yyyy
    //     const date = DateTime.fromISO(discrepancy.date).toFormat('dd.LL.yyyy');
    //
    //     // If user clicks saveButton then hide tr where first td element contains discrepancy.date in table id="assistent-discrepancies-table"
    //     const tr = Array.from(document.querySelectorAll('#assistent-discrepancies-table tbody tr')).find(tr => {
    //         const td = tr.querySelector('td');
    //         return td?.textContent === date;
    //     }) as HTMLElement;
    //
    //     if (tr) {
    //         tr.style.display = 'none';
    //     }
    //
    //     // count tr's left in #assistent-discrepancies-table
    //     const trs = document.querySelectorAll('#assistent-discrepancies-table tbody tr');
    //     console.log('trs', trs.length);
    //
    //     // trs.length === 1 then remove #assistent-discrepancies-table
    //     if (trs.length === 1) {
    //         const table = document.querySelector('#assistent-discrepancies-table') as HTMLElement;
    //         table.style.display = 'none';
    //     }
    //
    //     // remove data from discrpanciesToTimetable
    //     // Retrieve the journal from the cache using the journal ID parsed from the current URL
    //     const journal = AssistentCache.getJournal(parseInt(window.location.href.split('/')[5]));
    //
    //     // Find the index of the discrepancy in the journal's differencesToTimetable array that matches the current discrepancy date
    //     const index = journal.differencesToTimetable.findIndex(d => d.date === discrepancy.date);
    //
    //     // Remove the discrepancy from the journal's differencesToTimetable array using the found index
    //     journal.differencesToTimetable.splice(index, 1);
    //
    //     // Update the journal in the cache with the modified differencesToTimetable array
    //     AssistentCache.updateJournal(journal);
    // });
  }

  static getXsrfToken(): string | null {
    const match = document.cookie.match(new RegExp("(^| )XSRF-TOKEN=([^;]+)"))
    return match ? match[2] : null
  }

  static handleSaveButtonClick(discrepancy: AssistentJournalDifference) {
    // saveButton.addEventListener('click', () => {
    // convert discrepancy.date to dd.mm.yyyy
    const date = DateTime.fromISO(discrepancy.date).toFormat("dd.LL.yyyy")

    // If user clicks saveButton then hide tr where first td element contains discrepancy.date in table id="assistent-discrepancies-table"
    const tr = Array.from(
      document.querySelectorAll("#assistent-discrepancies-table tbody tr")
    ).find((tr) => {
      const td = tr.querySelector("td")
      return td?.textContent === date
    }) as HTMLElement

    if (tr) {
      tr.style.display = "none"
    }

    // count tr's left in #assistent-discrepancies-table
    const trs = document.querySelectorAll(
      "#assistent-discrepancies-table tbody tr"
    )

    // trs.length === 1 then remove #assistent-discrepancies-table
    if (trs.length === 1) {
      const table = document.querySelector(
        "#assistent-discrepancies-table"
      ) as HTMLElement
      table.style.display = "none"
    }

    // remove data from discrpanciesToTimetable
    // Retrieve the journal from the cache using the journal ID parsed from the current URL
    const journal = AssistentCache.getJournal(
      parseInt(window.location.href.split("/")[5])
    )

    // Find the index of the discrepancy in the journal's differencesToTimetable array that matches the current discrepancy date
    const index = journal.differencesToTimetable.findIndex(
      (d) => d.date === discrepancy.date
    )

    // Remove the discrepancy from the journal's differencesToTimetable array using the found index
    journal.differencesToTimetable.splice(index, 1)

    // Update the journal in the cache with the modified differencesToTimetable array
    AssistentCache.updateJournal(journal)
    // });
  }

  // Function to preselect the journal entry capacity types
  static async setJournalEntryTypeAsContactLesson(): Promise<void> {
    // Find the checkbox with the specified aria-label
    const checkbox = (await AssistentDom.waitForElement(
      'md-checkbox[aria-label="Auditoorne õpe"]'
    )) as HTMLElement

    if (!checkbox) {
      throw new AssistentDetailedError(
        500,
        "Element not found",
        "Checkbox element not found."
      )
    }

    // Simulate a click on the checkbox
    checkbox.click()

    // Make checkbox border 2px green
    checkbox.style.border = "2px solid #40ff6d"
  }

  static async setJournalEntryTypeAsLesson(): Promise<void> {
    await TahvelDom.selectDropdownOption(
      "journalEntry.entryType",
      "SISSEKANNE_T"
    )
  }

  static async setJournalEntryDate(
    discrepancy: AssistentJournalDifference
  ): Promise<void> {
    // Find the input element with the specified class
    const datepickerInput = (await AssistentDom.waitForElement(
      ".md-datepicker-input"
    )) as HTMLInputElement

    if (!datepickerInput) {
      throw new AssistentDetailedError(
        500,
        "Element not found",
        "Datepicker input field not found."
      )
    }

    // Extract only the date portion from the provided date string
    const date = new Date(discrepancy.date)
    const formattedDate = DateTime.fromJSDate(date).toFormat("dd.LL.yyyy")

    if (!datepickerInput) {
      throw new AssistentDetailedError(
        500,
        "Element not found",
        "Datepicker input field not found."
      )
    }

    // Set the value for the datepicker input
    datepickerInput.value = formattedDate

    // Dispatch an input event to notify AngularJS of the input value change
    const inputEvent = new Event("input", { bubbles: true })
    datepickerInput.dispatchEvent(inputEvent)

    // Make the datepicker input border green
    datepickerInput.style.border = "2px solid #40ff6d"
  }

  static async fetchJournalData(journalId: number): Promise<{
    entries: AssistentJournalEntry[]
    learningOutcomes: AssistentLearningOutcomes[]
  }> {
    let response: (apiJournalEntry | apiCurriculumModuleEntry)[]

    try {
      response = await Api.get(`/journals/${journalId}/journalEntriesByDate`)
    } catch (e) {
      if (e.statusCode === 412) {
        return {
          entries: [],
          learningOutcomes: []
        }
      }
      throw new AssistentDetailedError(
        500,
        "Error",
        "Journal entries data is missing or in unexpected format"
      )
    }

    if (!response) {
      throw new AssistentDetailedError(
        500,
        "Error",
        "Journal entries data is missing or in unexpected format"
      )
    }

    function getGradeNumber(gradeCode: string): number {
      if (gradeCode.includes("MA")) {
        return 2
      } else if (/[^A-Za-z]A$/.test(gradeCode) || /^A$/.test(gradeCode)) {
        return 5
      } else {
        const match = gradeCode.match(/\d+/)
        return match ? parseInt(match[0], 10) : 0
      }
    }

    const entries: AssistentJournalEntry[] = response
      .filter(
        (entry): entry is apiJournalEntry =>
          (entry as apiJournalEntry).lessons !== undefined
      )
      .map((entry) => {
        const studentResults = entry.journalStudentResults
          ? Object.keys(entry.journalStudentResults).flatMap((studentId) =>
              entry.journalStudentResults[studentId].map((result) => ({
                studentId: result.journalStudentId,
                gradeCode: result.grade?.code || "",
                gradeNumber: getGradeNumber(result.grade?.code || "")
              }))
            )
          : []

        return {
          id: entry.id,
          date: entry.entryDate,
          name: entry.nameEt,
          lessonType:
            entry.entryType === "SISSEKANNE_T"
              ? LessonType.lesson
              : entry.entryType === "SISSEKANNE_I"
              ? LessonType.independentWork
              : LessonType.other,
          lessonCount: entry.lessons,
          firstLessonStartNumber: entry.startLessonNr,
          journalStudentResults: studentResults
        }
      })

    const learningOutcomes: AssistentLearningOutcomes[] = response
      .filter(
        (entry): entry is apiCurriculumModuleEntry =>
          entry.entryType === "SISSEKANNE_O" ||
          entry.entryType === "SISSEKANNE_L"
      )
      .map((entry) => ({
        journalId: journalId,
        name: entry.nameEt,
        code: (entry.outcomeOrderNr + 1).toString(),
        curriculumModuleOutcomes: entry.curriculumModuleOutcomes,
        entryType: entry.entryType,
        studentOutcomeResults: Object.values(
          entry.studentOutcomeResults || {}
        ).map((result: apiStudentOutcomeEntry) => ({
          studentId: result.studentId
        }))
      }))

    return {
      entries,
      learningOutcomes
    }
  }

  static async fetchExercisesLists(
    journalId: number
  ): Promise<AssistentExerciseListEntry[]> {
    let response: { content: apiExercisesListEntry[] }

    try {
      response = await Api.get(`/journals/${journalId}/journalEntry`)
      console.log(response)
    } catch (e) {
      if (e.statusCode === 412) {
        return []
      }
      throw new AssistentDetailedError(
        500,
        "Error",
        "Journal entries data is missing or in unexpected format"
      )
    }

    if (!response || !response.content) {
      throw new AssistentDetailedError(
        500,
        "Error",
        "Journal entries data is missing or in unexpected format"
      )
    }

    return response.content.map((entry) => {
      // Parse and format the date, unless it's null
      let formattedDate = null;
      if (entry.homeworkDuedate) {
        const dueDate = new Date(entry.homeworkDuedate);
        const day = String(dueDate.getDate()).padStart(2, "0");
        const month = String(dueDate.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed
        const year = dueDate.getFullYear();
        formattedDate = `${day}.${month}.${year}`; // dd.mm.yyyy format
      }

      const learningOutcomeMatches = entry.nameEt?.match(/ÕV(\d+)/g);
      const learningOutcomes = learningOutcomeMatches
          ? learningOutcomeMatches.map((match) => parseInt(match.replace("ÕV", ""), 10))
          : [];

      return {
        id: entry.id,
        learningOutcomes: learningOutcomes,
        content: entry.content,
        lessonType:
            entry.entryType === "SISSEKANNE_T"
                ? LessonType.lesson
                : entry.entryType === "SISSEKANNE_I"
                    ? LessonType.independentWork
                    : LessonType.other,
        homeworkDuedate: formattedDate // Keep it as null if it was originally null
      };
    });
  }

  private static async createActionButtonForLessonDiscrepancyAction(
    discrepancy: AssistentJournalDifference
  ) {
    const isLessonsInDiaryButNotInTimetable =
      discrepancy.journalLessonCount > 0 &&
      discrepancy.timetableLessonCount === 0
    const isLessonsInTimetableButNotInDiary =
      discrepancy.timetableLessonCount > 0 &&
      discrepancy.journalLessonCount === 0
    const journalEntryElement: HTMLElement =
      await TahvelJournal.findJournalEntryElement(discrepancy)

    const action = {
      color: "",
      text: "",
      elementOrSelector: journalEntryElement,
      callback: async () => {}
    }

    let deleteButton
    if (isLessonsInDiaryButNotInTimetable) {
      action.color = "md-warn"
      action.text = "Vaata sissekannet"
      action.callback = async () => {
        const style = TahvelDom.createBlinkStyle()
        document.head.append(style)
        deleteButton = (await AssistentDom.waitForElement(
          'button[ng-click="delete()"]'
        )) as HTMLElement
        if (deleteButton) {
          deleteButton.classList.add("blink")
        }
        TahvelJournal.handleSaveButtonClick(discrepancy)
      }
    } else if (isLessonsInTimetableButNotInDiary) {
      action.color = "md-primary"
      action.text = "Lisa sissekanne"
      action.elementOrSelector = (await AssistentDom.waitForElement(
        'button[ng-click="addNewEntry()"]'
      )) as HTMLElement

      if (!action.elementOrSelector) {
        throw new AssistentDetailedError(
          500,
          "Element not found",
          "Add new entry button not found."
        )
      }

      action.callback = async () => {
        await TahvelJournal.setJournalEntryTypeAsLesson()
        await TahvelJournal.setJournalEntryDate(discrepancy)
        await TahvelJournal.setJournalEntryTypeAsContactLesson()
        await TahvelJournal.setJournalEntryStartLessonNr(discrepancy)
        await TahvelJournal.setJournalEntryCountOfLessons(discrepancy)
      }
    } else {
      action.color = "md-accent"
      action.text = "Muuda sissekannet"
      action.callback = async () => {
        if (
          discrepancy.journalFirstLessonStartNumber !==
          discrepancy.timetableFirstLessonStartNumber
        ) {
          await TahvelJournal.setJournalEntryStartLessonNr(discrepancy)
        }
        if (
          discrepancy.journalLessonCount !== discrepancy.timetableLessonCount
        ) {
          await TahvelJournal.setJournalEntryCountOfLessons(discrepancy)
        }
      }
    }

    return TahvelDom.createActionButton(
      action.color,
      action.text,
      action.elementOrSelector,
      action.callback
    )
  }

  // Function to find and click the radio button
  static setGradeInputAsSelectToFalse() {
    // Find the radio button by its attributes
    const radioButton = document.querySelector(
      'md-radio-button[aria-label="Sisestusväljana"]'
    )
    // If the radio button is found, trigger a click event
    if (radioButton) {
      ;(radioButton as HTMLElement).click()
    } else {
      console.error("Radio button not found")
    }
  }

  // eslint-disable-next-line
  static async fetchJournalEntry(journalId: number, exerciseId: number): Promise<any> {
    try {
      const response = await AssistentApiClient.get(
        `/journals/${journalId}/journalEntry/${exerciseId}`
      )
      return response
    } catch (error) {
      console.error(`Failed to fetch journal entry ${exerciseId}`, error)
      throw error
    }
  }
}


export default TahvelJournal;
