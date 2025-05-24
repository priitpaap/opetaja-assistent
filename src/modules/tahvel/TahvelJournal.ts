import { DateTime } from "luxon"

import Api from "~src/shared/AssistentApiClient"
import AssistentApiClient from "~src/shared/AssistentApiClient"
import AssistentCache from "~src/shared/AssistentCache"
import { AssistentDetailedError } from "~src/shared/AssistentDetailedError"
import AssistentDom from "~src/shared/AssistentDom"
import {
  type AssistentExerciseListEntry,
  type AssistentJournal,
  type AssistentJournalDifference,
  type AssistentJournalEntry,
  type AssistentLearningOutcomes,
  LessonType
} from "~src/shared/AssistentTypes"

import TahvelDom from "./TahvelDom"
import {
  type apiCurriculumModuleEntry,
  type apiExercisesListEntry,
  type apiJournalEntry,
  type apiStudentOutcomeEntry
} from "./TahvelTypes"

class TahvelJournal {
  //eslint-disable-next-line
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

  static async addGradingOptionsAndUpdateGrades() {
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
    if (!journal) return

    const targetElement = document.getElementById("journalEntriesByDate")
    if (!targetElement) {
      console.error("Target element 'journalEntriesByDate' not found.")
      return
    }

    // Check if there are any learning outcome columns in the table
    const hasLearningOutcomeColumns = Array.from(
        document.querySelectorAll("th")
    ).some((th) => th.textContent.includes("ÕV"))

    // If no learning outcome columns, do not show the button
    if (!hasLearningOutcomeColumns) {
      return
    }

    const gradingType = journal.gradingType // 'numeric' or 'passFail'
    const isPassFail = gradingType === "passFail"
    const isNumeric = gradingType === "numeric"
    const passFailText = `Mitteeristav hindamine${
        isPassFail ? " (vaikimisi)" : ""
    }`
    const numericText = `Eristav hindamine${isNumeric ? " (vaikimisi)" : ""}`

    const customDiv = document.createElement("div")
    customDiv.innerHTML = `  
  <div id="custom-options-container" style="margin-top: 20px; display: flex; justify-content: flex-end;">
    <select id="gradingTypeSelect" style="width: 220px; height: 35px; font-size: 15px; padding: 2px; margin: 5px; border-radius: 4px; border: 1px solid #ccc;">
      <option value="empty" selected></option>
      <option value="passFail">${passFailText}</option>
      <option value="numeric">${numericText}</option>
    </select>
    <button id="update-grades-btn" class="md-raised md-button md-ink-ripple md-primary" style="margin-left: 10px;" disabled>
      Lisa/uuenda kõik ÕV hinded automaatselt
    </button>
    <div id="confirmationDialog" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background-color:white; padding:20px; border:1px solid #ccc; border-radius:8px; z-index:1000;">
        <div style="display: flex; justify-content: flex-end;">
          <span id="closeDialog" style="cursor: pointer; font-size: 20px; font-weight: bold;">&times;</span>
        </div>
         <p>Kas uuendan ka olemasolevaid hindeid?</p>
        <label>
          <input type="checkbox" id="dontAskAgainCheckbox" />
          Ära küsi enam
        </label>
        <br /><br />
          <button class="md-raised md-button md-ink-ripple md-primary" style="background-color:#EF5350" id="confirmButton">Kirjuta vanad üle</button>
          <button class="md-raised md-button md-ink-ripple md-accent" style="background-color:#757575" id="cancelButton">Jäta vanad alles</button>
      </div>
  </div>
`
    const lessonsInTimetable = journal.entriesInTimetable.length
    if (
        Math.max(lessonsInTimetable, journal.contactLessonsInJournal) >=
        journal.contactLessonsPlanned
    ) {
      targetElement.insertAdjacentElement("afterend", customDiv)
    }

    const gradingTypeSelect = document.getElementById(
        "gradingTypeSelect"
    ) as HTMLSelectElement
    const updateGradesBtn = document.getElementById(
        "update-grades-btn"
    ) as HTMLButtonElement

    updateGradesBtn.setAttribute("disabled", "")
    updateGradesBtn.addEventListener("mouseenter", () => {
      if (updateGradesBtn.hasAttribute("disabled")) {
        TahvelJournal.showTooltip(updateGradesBtn, "Vali esmalt hindamisliik")
      }
    })

    updateGradesBtn.addEventListener("mouseleave", () => {
      TahvelJournal.hideTooltip()
    })

    const savedGradingType = localStorage.getItem("selectedGradingType")
    if (savedGradingType) {
      gradingTypeSelect.value = savedGradingType
      if (gradingTypeSelect.value !== gradingType) {
        gradingTypeSelect.style.color = "red" // Set the background color to red if the value doesn't match
      } else {
        gradingTypeSelect.style.color = ""
      }
      updateGradesBtn.removeAttribute("disabled") // Enable the button if a valid grading type is saved
    }

    // Add event listener for the grading type dropdown change event
    gradingTypeSelect.addEventListener("change", async () => {
      if (gradingTypeSelect.value !== "empty") {
        updateGradesBtn.removeAttribute("disabled")
        if (gradingTypeSelect.value !== gradingType) {
          gradingTypeSelect.style.color = "red" // Set the background color to red if the value doesn't match
        } else {
          gradingTypeSelect.style.color = "" // Reset the background color to default
        }
        // Save the selected grading type to localStorage
        localStorage.setItem("selectedGradingType", gradingTypeSelect.value)
        localStorage.removeItem("confirmGradesDeletion")
        localStorage.removeItem("dontAskAgain")

        await TahvelJournal.checkAndHighlightLearningOutcomesGrades() // Now this is valid because the enclosing function is async
      } else {
        updateGradesBtn.setAttribute("disabled", "")
        gradingTypeSelect.style.color = ""
        gradingTypeSelect.style.backgroundColor = ""
        // Remove the grading type from localStorage if 'empty' is selected
        localStorage.removeItem("selectedGradingType")
      }
    })

    document
        .getElementById("update-grades-btn")
        .addEventListener("click", async () => {
          const confirmExistingGradesUpdate = localStorage.getItem(
              "confirmExistingGradesUpdate"
          )
          const dontAskAgain = localStorage.getItem("dontAskAgain")
          let userConfirmed = confirmExistingGradesUpdate != null

          if (dontAskAgain == null || confirmExistingGradesUpdate == null) {
            // Show the confirmation dialog if 'dontAskAgain' is not checked and the user hasn't made a decision yet
            userConfirmed = await TahvelJournal.showConfirmationDialog()
          }

          if (userConfirmed) {
            await TahvelJournal.AddOrUpdateLearningOutcomesGrades(journal)
            window.location.reload()
          }
        })
  }

  static async showConfirmationDialog(): Promise<boolean> {
    return new Promise((resolve) => {
      const confirmationDialog = document.getElementById("confirmationDialog")
      confirmationDialog.style.display = "block"

      const confirmButton = document.getElementById("confirmButton")
      const cancelButton = document.getElementById("cancelButton")
      const dontAskAgainCheckbox = document.getElementById(
          "dontAskAgainCheckbox"
      ) as HTMLInputElement
      const closeDialog = document.getElementById("closeDialog")

      confirmButton.onclick = () => {
        if (dontAskAgainCheckbox.checked) {
          localStorage.setItem("dontAskAgain", "true")
        }
        confirmationDialog.style.display = "none"
        localStorage.setItem("confirmExistingGradesUpdate", "true")
        resolve(true)
      }

      cancelButton.onclick = () => {
        if (dontAskAgainCheckbox.checked) {
          localStorage.setItem("dontAskAgain", "true")
        }
        confirmationDialog.style.display = "none"
        localStorage.setItem("confirmExistingGradesUpdate", "false")
        resolve(true)
      }

      closeDialog.onclick = () => {
        confirmationDialog.style.display = "none"
      }
    })
  }

  static async AddOrUpdateLearningOutcomesGrades(journal) {
    const gradingTypeSelect = document.getElementById(
        "gradingTypeSelect"
    ) as HTMLSelectElement
    const selectedGradingType = gradingTypeSelect.value

    // Iterate over each learning outcome
    for (const outcome of journal.learningOutcomes) {
      const outcomeCode = Number(outcome.code) // Ensure outcomeCode is a number
      const outcomeId = outcome.curriculumModuleOutcomes

      // Fetch the existing outcome entry for the current learning outcome
      const existingOutcome = await TahvelJournal.fetchJournalOutcome(
          journal.id,
          outcomeId
      )

      // Initialize payload for the current outcome
      const outcomeResults = []

      const confirmExistingGradesUpdate =
          localStorage.getItem("confirmExistingGradesUpdate") == "true"

      // Loop through each student and calculate/update the grades
      for (const student of journal.students) {
        const studentId = student.studentId

        // Skip processing for students on academic leave
        if (student.status === "academicLeave") {
          continue
        }

        try {
          // Check if this student is missing any independent work for this learning outcome
          const notAllFinished = journal.studentsMissingIndependentWork.some(
              (studentMissing) =>
                  studentMissing.studentId === student.id &&
                  studentMissing.exerciseList.some((exercise) =>
                      exercise.learningOutcomes.includes(outcomeCode)
                  )
          )

          // Find if there is an existing outcome for the student
          const existingOutcomeStudent = existingOutcome.outcomeStudents.find(
              //eslint-disable-next-line
              (os: any) => os.studentId === studentId
          )

          if (notAllFinished) {
            // If there is already a grade and work is not finished, add to the list with grade: null
            if (existingOutcomeStudent && confirmExistingGradesUpdate) {
              outcomeResults.push({
                studentId: studentId,
                isCurriculumOutcome: true,
                canEdit: true,
                journalStudent: student.id,
                grade: null,
                id: existingOutcomeStudent.id, // Keep the original ID
                version: existingOutcomeStudent.version, // Keep the original version
                gradeDate: new Date().toISOString(),
                removeStudentHistory: true
              })
            }
            continue // Skip further processing if work is not finished
          }

          // Calculate the student's grade
          const studentGrades = TahvelJournal.getAllGradesForStudent(
              journal.entriesInJournal,
              student.id,
              outcomeCode
          )

          if (studentGrades.length > 0) {
            const calculatedGrade = TahvelJournal.calculateGrade(
                selectedGradingType,
                studentGrades
            )

            // Prepare the outcome result object
            //eslint-disable-next-line
            const outcomeResult: any = {
              studentId: studentId,
              isCurriculumOutcome: true,
              canEdit: true,
              gradeValue: calculatedGrade.toString(),
              journalStudent: student.id,
              grade: {
                code: `KUTSEHINDAMINE_${calculatedGrade}`,
                gradingSchemaRowId: null
              },
              gradeDate: new Date().toISOString(),
              removeStudentHistory: true
            }

            // If there is an existing outcome and the grades differ, update
            if (
                existingOutcomeStudent &&
                existingOutcomeStudent.grade.code !== outcomeResult.grade.code &&
                confirmExistingGradesUpdate
            ) {
              outcomeResult.id = existingOutcomeStudent.id
              outcomeResult.version = existingOutcomeStudent.version
            } else if (existingOutcomeStudent) {
              // If the grades match, continue without changes
              continue
            }

            outcomeResults.push(outcomeResult)
          }
        } catch (error) {
          console.error(
              `Error processing grade for student ${studentId}:`,
              error
          )
        }
      }

      // Only save after processing all students for the current outcome
      if (outcomeResults.length > 0) {
        const payload = {outcomeStudents: outcomeResults}

        // Send POST request to save the grades
        const endpoint = `/journals/${journal.id}/journalOutcome/${outcomeId}/quickUpdate`
        try {
          await AssistentApiClient.post(endpoint, payload)
        } catch (error) {
          console.error(
              `Failed to save grades for learning outcome ${outcomeId}:`,
              error
          )
        }
      }
    }
  }

  static getAllGradesForStudent(
      entriesInJournal: AssistentJournalEntry[],
      studentId: number,
      learningOutcomeCode: number
  ): number[] {
    const grades: number[] = []

    for (const journalEntry of entriesInJournal) {
      // Ensure that journalEntry.name is not null or undefined before calling match
      if (!journalEntry.name) {
        continue // Skip this journal entry if name is null or undefined
      }

      // Extract the ÕV codes from the journalEntry name
      const learningOutcomeMatches = journalEntry.name.match(/ÕV(\d+)/g)
      const learningOutcomes = learningOutcomeMatches
          ? learningOutcomeMatches.map((match) =>
              parseInt(match.replace("ÕV", ""), 10)
          )
          : []

      // Check if any of the ÕV codes match the provided learningOutcomeCode
      if (!learningOutcomes.includes(learningOutcomeCode)) {
        continue // Skip this journal entry if there is no match
      }
      const studentResults = journalEntry.journalStudentResults
          .filter(
              (result) => result.studentId === studentId && result.gradeNumber > 0
          )
          .map((result) => result.gradeNumber)

      grades.push(...studentResults)
    }
    return grades
  }

  static calculateGrade(
      gradingType: string,
      grades: number[]
  ): string | number {
    const sum = grades.reduce((acc, grade) => acc + grade, 0)
    const averageGrade = sum / grades.length

    if (gradingType === "numeric") {
      // Custom rounding logic: round down if decimal < 0.5, otherwise round up
      return averageGrade % 1 < 0.5
          ? Math.floor(averageGrade)
          : Math.ceil(averageGrade)
    } else {
      const minGrade = Math.min(...grades)
      return minGrade < 3 ? "MA" : "A"
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
    const inputEvent = new Event("input", {bubbles: true})
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
    const inputEvent = new Event("input", {bubbles: true})
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
    const inputEvent = new Event("input", {bubbles: true})
    commentInput.dispatchEvent(inputEvent)
  }

  static async saveGradesForOutcome(code: string) {
    console.log("Saving grades for outcome", code)

    // Select the md-icon element by aria-label
    const saveIcon = document.querySelector(
        'md-icon[aria-label="done"]'
    ) as HTMLElement

    if (saveIcon) {
      saveIcon.click()
      console.log(`Grades saved for outcome ${code}`)
    } else {
      console.error(
          "Save icon not found. Ensure the selector is correct and the element is present in the DOM."
      )
    }
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
    const inputEvent = new Event("input", {bubbles: true})
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

          const lessonTypeMapping = {
            SISSEKANNE_T: LessonType.lesson,
            SISSEKANNE_I: LessonType.independentWork,
            SISSEKANNE_E: LessonType.eLearning,
            SISSEKANNE_H: LessonType.grading,
            SISSEKANNE_P: LessonType.practicalWork
          }

          return {
            id: entry.id,
            date: entry.entryDate,
            name: entry.nameEt,
            lessonType: lessonTypeMapping[entry.entryType] || LessonType.other,
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
            id: result.id,
            gradeCode: result.grade?.code.replace("KUTSEHINDAMINE_", "") || "",
            gradeNumber: getGradeNumber(result.grade?.code || ""),
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
      // Parse and format the homeworkDuedate, unless it's null
      let formattedHomeworkDuedate = null
      if (entry.homeworkDuedate) {
        const dueDate = new Date(entry.homeworkDuedate)
        const day = String(dueDate.getDate()).padStart(2, "0")
        const month = String(dueDate.getMonth() + 1).padStart(2, "0") // Months are zero-indexed
        const year = dueDate.getFullYear()
        formattedHomeworkDuedate = `${day}.${month}.${year}` // dd.mm.yyyy format
      }

      // Parse and format the entryDate, unless it's null
      let formattedEntryDate = null
      if (entry.entryDate) {
        const entryDate = new Date(entry.entryDate)
        const day = String(entryDate.getDate()).padStart(2, "0")
        const month = String(entryDate.getMonth() + 1).padStart(2, "0") // Months are zero-indexed
        const year = entryDate.getFullYear()
        formattedEntryDate = `${day}.${month}.${year}` // dd.mm.yyyy format
      }

      const learningOutcomeMatches = entry.nameEt?.match(/ÕV(\d+)/g)
      const learningOutcomes = learningOutcomeMatches
          ? learningOutcomeMatches.map((match) =>
              parseInt(match.replace("ÕV", ""), 10)
          )
          : []

      return {
        id: entry.id,
        learningOutcomes: learningOutcomes,
        content: entry.content,
        nameEt: entry.nameEt,
        lessonType:
            entry.entryType === "SISSEKANNE_T"
                ? LessonType.lesson
                : entry.entryType === "SISSEKANNE_I"
                    ? LessonType.independentWork
                    : LessonType.other,
        homeworkDuedate: formattedHomeworkDuedate, // Keep it as null if it was originally null
        entryDate: formattedEntryDate // Keep it as null if it was originally null
      }
    })
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
      callback: async () => {
      }
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

  //eslint-disable-next-line
  static async fetchJournalEntry(journalId: number, exerciseId: number): Promise<any> {
    try {
      return await AssistentApiClient.get(
          `/journals/${journalId}/journalEntry/${exerciseId}`
      )
    } catch (error) {
      console.error(`Failed to fetch journal entry ${exerciseId}`, error)
      throw error
    }
  }

  static async colorJournalEntryCell() {
    const table = document.querySelector(".journalTable")

    if (!table) return

    const journal = AssistentCache.getJournal(
        parseInt(window.location.href.split("/")[5])
    )
    if (!journal || !journal.exercisesLists) return

    // Insert ARIA labels for the journal table
    TahvelJournal.insertAriaLabelText(journal)

    // Initial cell coloring
    TahvelJournal.colorMissingIndependentWorkCells(journal)

    // Initial grade check and highlighting
    await TahvelJournal.checkAndHighlightLearningOutcomesGrades()

    // Create the observer
    const observer = new MutationObserver(async () => {
      // Disconnect the observer to avoid infinite loop
      observer.disconnect()

      // Update the journal and recolor cells
      await TahvelJournal.updateJournalAndTableView(journal)

      // Reconnect the observer after updates are done
      observer.observe(table, {
        childList: true, // Watch for changes to the child elements
        subtree: true, // Watch for changes to all descendant elements
        characterData: true, // Watch for changes to text content
        attributes: true, // Watch for changes to attributes like classes, styles, etc.
        attributeFilter: ["class"] // Specifically monitor these attributes
      })
    })

    // Start observing the table for mutations
    observer.observe(table, {
      childList: true, // Watch for changes to the child elements
      subtree: true, // Watch for changes to all descendant elements
      characterData: true, // Watch for changes to text content
      attributes: true, // Watch for changes to attributes like classes, styles, etc.
      attributeFilter: ["class"] // Specifically monitor these attributes
    })
  }


  private static async updateJournalAndTableView(journal) {
    journal.exercisesLists = await TahvelJournal.fetchExercisesLists(journal.id)
    const data = await TahvelJournal.fetchJournalData(journal.id)
    journal.learningOutcomes = data.learningOutcomes
    journal.entriesInJournal = data.entries
    AssistentCache.findIndependentWorkDiscrepancies(journal.id)
    TahvelJournal.insertAriaLabelText(journal)
    TahvelJournal.colorMissingIndependentWorkCells(journal)
    await TahvelJournal.checkAndHighlightLearningOutcomesGrades()
  }

  static async checkAndHighlightLearningOutcomesGrades() {
    // Step 1: Fetch the journal data
    const journal = await TahvelJournal.getJournalWithValidation();
    if (!journal) return;

    // Check if all planned work is given
    const allLessonsAreInJournal = journal.contactLessonsInJournal - journal.contactLessonsPlanned >= -1;

    // Get the last date from entriesInTimetable and format it
    const lastTimetableEntry = journal.entriesInTimetable[journal.entriesInTimetable.length - 1];
    const formattedDate = new Date(lastTimetableEntry.date).toLocaleDateString("et-EE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    // Step 2: Find all headers with a class 'journal-entry-button pointer' that contain 'ÕV' + outcomeCode
    journal.learningOutcomes.forEach((outcome) => {
      const outcomeCode = Number(outcome.code);

      // Find the header element that matches 'ÕV' + outcomeCode
      const header = Array.from(document.querySelectorAll("th")).find((th) => {
        // Use regex to match the exact pattern
        const headerSpan = th.querySelector("span.journal-entry-button.pointer");
        return headerSpan && headerSpan.textContent.trim().match(new RegExp(`^ÕV${outcomeCode}$`));
      });

      if (!header) return; // Skip if no matching header is found

      const headerIndex = Array.from(header.parentElement.children).indexOf(header);

      // Step 3: Iterate through each student in journal.students
      journal.students.forEach((student) => {
        const studentRow = TahvelJournal.findTableRowById(student.studentId);

        if (!studentRow) {
          console.log(`No matching row found for studentId ${student.studentId}`);
          return; // Skip if no matching row is found for the student
        }

        const cell = studentRow.children[headerIndex] as HTMLElement;

        if (!cell) {
          console.log(`No matching cell found for studentId ${student.studentId} at header index ${headerIndex}`);
          return; // Skip if no cell found
        }

        if (student.status === "academicLeave") {
          cell.style.backgroundColor = "#7fbfff"; // Blue color when student is on academic leave
          cell.setAttribute("data-tooltip", `Õppija on akadeemilisel puhkusel`);
          cell.classList.add("tooltip-container");
          return; // If student is on academic leave, skip further processing
        }

        // Calculate the student's average grade for this outcome
        const studentGrades = TahvelJournal.getAllGradesForStudent(
            journal.entriesInJournal,
            student.id, // Use the `id` from the student entry
            outcomeCode
        );

        // Check if this student is missing any independent work for this learning outcome
        const allAssigmentsGraded = !journal.studentsMissingIndependentWork.some(
            (studentMissing) =>
                studentMissing.studentId === student.id &&
                studentMissing.exerciseList.some((exercise) =>
                    exercise.learningOutcomes.includes(outcomeCode))
        );

        // Check if grades can be assigned
        const canAssignGrade = allAssigmentsGraded && studentGrades.length > 0;

        const result = outcome.studentOutcomeResults?.find(
            (res) => res.studentId === student.studentId
        );

        if (!allAssigmentsGraded) {
          if (allLessonsAreInJournal && !result) {
            cell.style.backgroundColor = "#ea8080"; // Red color when not all work is finished
            cell.setAttribute("data-tooltip", `Õpiväljundi hinded tuleb välja panna ${formattedDate}`);
            cell.classList.add("tooltip-container");
          } else {
            // Light yellow color when not all work is finished and not all lessons are given
            cell.style.backgroundColor = "rgb(255, 236, 179)";
            cell.setAttribute("data-tooltip", `Antud ÕV-ga seotud tööd on vaja enne ära hinnata`);
            cell.classList.add("tooltip-container");
          }
          return; // If not all work is finished, skip further processing
        }

        if (canAssignGrade) {
          // Determine the grading type to use; default to journal.gradingType if result is undefined
          const gradingTypeToUse = localStorage.getItem("selectedGradingType") || journal.gradingType;
          const calculatedGrade = TahvelJournal.calculateGrade(gradingTypeToUse, studentGrades);

          let actualGrade = null;
          if (result) {
            actualGrade = /MA|A/.test(result.gradeCode)
                ? result.gradeCode
                : result.gradeNumber;
          }

          if (!result) {
            cell.style.backgroundColor = "rgb(197, 202, 233)";
            cell.setAttribute("data-tooltip", `Võib panna ${calculatedGrade}`);
            cell.classList.add("tooltip-container");
          } else if (calculatedGrade !== actualGrade) {
            // If the grade is incorrect
            cell.style.backgroundColor = "rgb(252, 228, 236)"; // Pink color for incorrect grades
            cell.setAttribute("data-tooltip", `Peab olema ${calculatedGrade}`);
            cell.classList.add("tooltip-container");
          } else {
            // If the grade is correct
            cell.style.backgroundColor = "#ffffff"; // Default color for correct grades
            cell.removeAttribute("data-tooltip");
            cell.classList.remove("tooltip-container");
          }
        } else {
          //Count exercises containing the learning outcome in the exercisesLists in learningOutcomes
          const exercisesWithLearningOutcome = journal.exercisesLists.filter(
              (exercise) => exercise.learningOutcomes.includes(outcomeCode)
          );

          // If there are no grades, apply the appropriate color
          if (allLessonsAreInJournal) {
            if (exercisesWithLearningOutcome.length <= 0) {
              cell.style.backgroundColor = "#ea8080";
              cell.setAttribute(
                  "data-tooltip",
                  `Pole ühtegi selle õpiväljundiga seotud sissekannet`
              );
              cell.classList.add("tooltip-container"); /// Red color for cells without a grade when all lessons are given
            } else {
              cell.style.backgroundColor = "rgb(255, 236, 179)";
              cell.setAttribute(
                  "data-tooltip",
                  `Õpiväljundi hindamine on veel pooleli`
              );
              cell.classList.add("tooltip-container"); // Light yellow color if grades cannot be assigned yet
            }
          }
        }
      });
    });
  }

  //eslint-disable-next-line
  static async fetchJournalOutcome(journalId: number, outcomeId: number): Promise<any> {
    try {
      return await AssistentApiClient.get(
          `/journals/${journalId}/journalOutcome/${outcomeId}`
      )
    } catch (error) {
      console.error(`Failed to fetch journal entry ${outcomeId}`, error)
      throw error
    }
  }

  private static colorMissingIndependentWorkCells(journal) {
    // Select all headers within the journal table that match the criteria
    const headers = Array.from(document.querySelectorAll(".journalTable th")).filter((th) => {
      const ariaLabel = th.querySelector("div[aria-label]")?.getAttribute("aria-label");
      return ariaLabel && /ÕV\d+/.test(ariaLabel);  // Ensure it contains ÕV followed by digits
    });

    headers.forEach((header) => {
      const headerIndex = Array.from(header.parentElement.children).indexOf(header); // Get the header's index

      // Find the div with aria-label to match against exercise.nameEt
      const headerDiv = header.querySelector('div[aria-label]');

      if (headerDiv) {
        const headerAriaLabel = headerDiv.getAttribute('aria-label');

        journal.exercisesLists.forEach((exercise) => {
          if (exercise.lessonType === LessonType.lesson) {
            return; // Skip exercises of type 'lesson'
          }

          // Check if header's aria-label contains nameEt
          if (headerAriaLabel && headerAriaLabel.includes(exercise.nameEt)) {
            // Found a matching header; now target the rows
            const rows = document.querySelectorAll('tr[ng-repeat="row in journal.journalStudents"]');

            rows.forEach((row) => {
              const cell = row.children[headerIndex] as HTMLElement; // Get the cell at the same index as the header

              if (cell && !this.hasValidGrade(cell.textContent)) {
                let isHomeworkDueInFuture = false;
                if (exercise.homeworkDuedate) {
                  const [dueDay, dueMonth, dueYear] = exercise.homeworkDuedate.split(".").map(Number);
                  const homeworkDueDate = new Date(dueYear, dueMonth - 1, dueDay);

                  isHomeworkDueInFuture = homeworkDueDate > new Date();
                }

                if (!isHomeworkDueInFuture || !exercise.homeworkDuedate) {
                  cell.style.backgroundColor = "#ea8080"; // Color cell only if homework due date is not in the future or is null

                  cell.addEventListener("mouseenter", () => {
                    TahvelJournal.showTooltip(
                        cell,
                        `Iseseisva töö hinne puudub (tähtaeg${
                            exercise.homeworkDuedate == null
                                ? ": määramata"
                                : " oli: " + exercise.homeworkDuedate
                        })`
                    );
                  });

                  cell.addEventListener("mouseleave", () => {
                    TahvelJournal.hideTooltip();
                  });
                }
              }
            });
          }
        });
      }
    });
  }

  // Helper function to determine if the cell contains a valid grade
  private static hasValidGrade(text: string | null): boolean {
    if (!text) return false
    // Regex to match grades like 'A', 'MA', any digit, or combinations with '/' like 'P / MA'
    const validGradePattern = /(^[AM]+$|^\d+$|(\d+\s*\/\s*)*[AM\d]+)$/
    return validGradePattern.test(text.trim())
  }

  // Function to create and show tooltip
  private static showTooltip(targetElement: HTMLElement, message: string) {
    const tooltip = document.createElement("div")
    tooltip.className = "custom-tooltip"
    tooltip.textContent = message
    document.body.appendChild(tooltip)

    const rect = targetElement.getBoundingClientRect()
    tooltip.style.left = `${
        rect.left +
        window.scrollX +
        targetElement.offsetWidth / 2 -
        tooltip.offsetWidth / 2
    }px`
    tooltip.style.top = `${
        rect.top + window.scrollY - tooltip.offsetHeight - 5
    }px`
  }

  // Function to hide tooltip
  private static hideTooltip() {
    const tooltip = document.querySelector(".custom-tooltip")
    if (tooltip) {
      tooltip.remove()
    }
  }

  static insertAriaLabelText(journal) {
    // Select all the headers to modify within the specific table
    const headers = document.querySelectorAll(".journalTable th");

    journal.exercisesLists.forEach((exercise) => {
      // Extract necessary fields from each exercise entry
      const learningOutcomes = exercise.learningOutcomes;
      let nameEt = exercise.nameEt;
      const homeworkDuedate = exercise.homeworkDuedate;

      // Check if learningOutcomes is not empty
      if (learningOutcomes && learningOutcomes.length > 0) {
        // Format the learning outcomes as [ÕV1, ÕV3]
        const formattedLearningOutcomes = `${learningOutcomes.map((outcome) => `ÕV${outcome}`).join(", ")}`;

        // Remove the text in parentheses including (ÕV)
        nameEt = nameEt.replace(/\(ÕV\d+(,\s*ÕV\d+)*\)/g, "").trim();

        // Limit nameEt to the first 15 characters after removing (ÕV)
        const limitedNameEt = nameEt.length > 30 ? nameEt.slice(0, 30).replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").trim() + "…": nameEt;

        // Find the corresponding header based on the `aria-label` containing the nameEt
        const matchingHeader = Array.from(headers).find((header) => {
          const ariaLabel = header.querySelector('div[aria-label]')?.getAttribute('aria-label');
          return ariaLabel && ariaLabel.includes(nameEt);
        }) ;

        if (matchingHeader) {
          const headerSpan = matchingHeader.querySelector('span.journal-entry-button.pointer') as HTMLElement;
          headerSpan.style.textDecoration = 'none';

          if (headerSpan) {
            // Modify only the content within the nested spans while preserving Angular directives
            const innerSpan = headerSpan.querySelector('span[ng-click]');

            if (innerSpan) {
              while (innerSpan.firstChild) {
                innerSpan.removeChild(innerSpan.firstChild);
              }

              // Create new content elements
              const dateAndLearningOutcomesSpan = document.createElement('span');
              dateAndLearningOutcomesSpan.textContent = `${homeworkDuedate || "määramata"} ${formattedLearningOutcomes}`;
              dateAndLearningOutcomesSpan.classList.add('date-and-learning-outcome-span');

              const assigmentTextSpan = document.createElement('span');
              assigmentTextSpan.textContent = `${limitedNameEt}`;
              assigmentTextSpan.classList.add('assigment-text-span');

              assigmentTextSpan.style.cssText = `
              overflow-wrap: break-all;
              `;

              innerSpan.appendChild(assigmentTextSpan);
              innerSpan.appendChild(dateAndLearningOutcomesSpan);
            }
          }
        }
      }
    });
  }
}

export default TahvelJournal
