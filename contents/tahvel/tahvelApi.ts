// console.log("Tahvel API!!!")
// Salvestame selle õppeaasta kõikide nädalate algus ja lõppkuupäevad:
 function getDateRanges(startYear, startMonth) {
    const currentDate = new Date();
    const dates = [];
  
    // Create a new date for the first day of the specified month and year
    const startDate = new Date(Date.UTC(startYear, startMonth - 1, 1)); // -1 because months are 0-indexed
  
    // If September doesn't start on a Monday, adjust the start date to the previous Monday
    if (startDate.getUTCDay() !== 1) {
      while (startDate.getUTCDay() !== 1) {
        startDate.setUTCDate(startDate.getUTCDate() - 1);
      }
    }
  
    // Generate dates for every Monday and Sunday until the current date
    while (startDate <= currentDate) {
      const from = new Date(startDate);
      const thru = new Date(from);
  
      // Set the time to 00:00:00 UTC
      from.setUTCHours(0, 0, 0, 0);
      thru.setUTCHours(0, 0, 0, 0);
  
      // Add 6 days to "from" for Monday, and 7 days to "thru" for Sunday
      thru.setUTCDate(from.getUTCDate() + 6);
  
      // Format the dates as needed
      const formattedFrom = from.toISOString().replace(".000Z", "Z");
      const formattedThru = thru.toISOString().replace(".000Z", "Z");
  
      dates.push({ from: formattedFrom, thru: formattedThru });
  
      // Move to the next week
      startDate.setUTCDate(startDate.getUTCDate() + 7);
    }
  
    return dates;
  }
  
  function fetchJsonData(startDate, endDate) {
    // Construct the URL based on the start and end dates
    const baseUrl = 'https://tahvel.edu.ee/json_files/hois_back/timetableevents/timetableByTeacher/';
    const startDateStr = startDate.replace(/:/g, '§');
    const endDateStr = endDate.replace(/:/g, '§');
    const url = `${baseUrl}9§from=${startDateStr}&teachers=18737&thru=${endDateStr}`;
  
    return fetch(url)
      .then((response) => {
        if (response.status === 200) {
          return response.json();
        } else if (response.status === 404) {
          return null; // Return null for 404 errors
        } else {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
      })
      .catch((error) => {
        // Catch any errors that may occur during the fetch
        console.error(`An error occurred while fetching JSON data: ${error.message}`);
        return null; // Return null for other errors
      });
  }
  
  const currentDate = new Date();
  const currentYear = currentDate.getUTCFullYear();
  const currentMonth = currentDate.getUTCMonth() + 1; // +1 because months are 0-indexed
  const startYear = currentMonth >= 9 ? currentYear : currentYear - 1;
  
  const dateRanges = getDateRanges(startYear, 9); // 9 represents September
  
  // Fetch JSON data for each date range and log only if data exists
  Promise.all(dateRanges.map((range) => fetchJsonData(range.from, range.thru)))
    .then((results) => {
      results.forEach((data, index) => {
        if (data !== null) {
          console.log(`Data for date range ${index + 1}:`, data);
        }
      });
    });

// Teine variant - toob andmed ainult siis, kui json failis on "timetableEvents" massiiv täidetud
/*

Promise.all(dateRanges.map((range) => fetchJsonData(range.from, range.thru)))
  .then((results) => {
    results.forEach((data, index) => {
      if (data && data.timetableEvents && data.timetableEvents.length > 0) {
        console.log(`Data for date range ${index + 1}:`, data);
      }
    });
  });

*/