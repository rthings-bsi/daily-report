
import http.client
import json

conn = http.client.HTTPConnection("localhost", 3000)
headers = {'Content-type': 'application/json'}
body = json.dumps({"messages": [{"role": "user", "content": "halo"}]})

try:
    conn.request("POST", "/api/chat", body, headers)
    response = conn.getresponse()
    print(f"Status: {response.status}")
    print(f"Headers: {response.getheaders()}")
    data = response.read()
    print(f"Response (first 500 chars): {data[:500]}")
except Exception as e:
    print(f"Connection error: {e}")
