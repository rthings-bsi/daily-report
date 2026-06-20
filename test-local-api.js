const http = require('http');

http.get('http://localhost:3000/api/reports/aggregate', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("Status Code:", res.statusCode);
    if (res.statusCode === 200) {
      try {
         const json = JSON.parse(data);
         console.log("Movements count:", json.movements?.length);
         if (json.movements?.length > 0) {
             const m = json.movements[0];
             console.log("Sample movement keys:", Object.keys(m));
             console.log("Group of first:", m.group);
             const masuk = json.movements.filter(x => x.group === 'Masuk').length;
             const keluar = json.movements.filter(x => x.group === 'Keluar').length;
             console.log(`Groups -> Masuk: ${masuk}, Keluar: ${keluar}`);
         }
      } catch (e) {
          console.log("Failed to parse JSON", data.substring(0, 100));
      }
    } else {
        console.log("Response:", data);
    }
  });
}).on('error', err => console.log(err));
