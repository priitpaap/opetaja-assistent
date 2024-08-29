import Api from "~src/shared/AssistentApiClient";
import {AssistentDetailedError} from "~src/shared/AssistentDetailedError";

class TahvelUser {

    static schoolId: number | null = null;
    static teacherId: number | null = null;

    static async init(): Promise<void> {

        // Check if browser URL did not contain "idlogin.html"
        if (window.location.href.includes("idlogin.html")) {
            //
            return new Promise((resolve, reject) => {return reject(new AssistentDetailedError(520, "User is not logged in", "User is not logged in"))});
        }

        const user = await Api.get(`/user`);

        // If the response object is an empty object, the user is not logged in
        if (!user || Object.keys(user).length === 0) {
            return
        }

        // Check schoolId
        if (!user.school.id) {
            throw new Error("School ID not found");
        }

        // Check teacherId
        if (!user.teacher) {
            throw new Error("Teacher ID not found");
        }

        TahvelUser.schoolId = user.school.id
        TahvelUser.teacherId = user.teacher
        // TahvelUser.teacherId = 18737;
    }

}

export default TahvelUser;
