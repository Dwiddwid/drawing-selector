export function csvToJSON(csv) {
  let test = csv.replace(/\r?\n|\r/gm, "\n");
  var lines = test.split("\n");
  var result = [];
  var headers;
  headers = lines[0].split(",");

  for (var i = 1; i < lines.length; i++) {
    var obj = {};

    if (lines[i] == undefined || lines[i].trim() == "") {
      continue;
    }

    var words = lines[i].split(",");
    for (var j = 0; j < words.length; j++) {
      obj[headers[j]] = words[j];
    }

    result.push(obj);
  }
  return result;
}
