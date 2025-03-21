# API Proxy v1.2
# Updated: 2022/03/20
# Aaron Scott (WiFi Downunder) 2022
# ------------------------------------------------------------------------------------------
# Convert JS based API calls into Python calls (to work around CORS) and return the results
# ------------------------------------------------------------------------------------------


from flask import Flask, jsonify, request, json, render_template, g
from flask_cors import CORS, cross_origin
from datetime import datetime
import flask
import logging
import requests
import binascii
import os

from logging.handlers import RotatingFileHandler

app = Flask(__name__)

cors = CORS(app, methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], supports_credentials=True, 
          expose_headers='Authorization', allow_headers=['Accept', 'Authorization', 'Cache-Control', 'Content-Type', 'DNT', 'If-Modified-Since', 'Keep-Alive', 'Origin', 'User-Agent', 'X-Requested-With'])

def create_timed_rotating_log(path):
	app.logger = logging.getLogger('werkzeug')
	handler = RotatingFileHandler(path, maxBytes=1024, backupCount=5) # creates handler for the log file
	app.logger.setLevel(logging.DEBUG) # controls the priority of the messages that are logged
	app.logger.addHandler(handler) # adds handler to the logger

log_file = "/central/API/timed_test.log" # creates this file at the specified path
create_timed_rotating_log(log_file)

@app.route('/auth/refresh', methods = ["POST"])
def tokenRefresh():
	data = request.get_json()
	url = data['base_url'] + "/oauth2/token"
	payload = json.dumps({
	  "client_id": data['client_id'],
	  "client_secret": data['client_secret'],
	  "grant_type": "refresh_token",
	  "refresh_token": data['refresh_token']
	})
	headers = {
	  'Authorization': 'Bearer ' + data['access_token'],
	  'Content-Type': 'application/json'
	}
	response = requests.request("POST", url, headers=headers, data=payload)

	try:
		result = jsonify(json.loads(response.text));
		# ...
	except ValueError:
		# no JSON returned
		result = jsonify(status=str(response.status_code), reason=response.reason);
	return result;

@app.route('/auth/refreshwHeaders', methods = ["POST"])
def tokenRefreshwHeaders():
	data = request.get_json()
	url = data['base_url'] + "/oauth2/token"
	payload = json.dumps({
	  "client_id": data['client_id'],
	  "client_secret": data['client_secret'],
	  "grant_type": "refresh_token",
	  "refresh_token": data['refresh_token']
	})
	headers = {
	  'Authorization': 'Bearer ' + data['access_token'],
	  'Content-Type': 'application/json'
	}
	response = requests.request("POST", url, headers=headers, data=payload)
	
	headers_json = json.dumps(dict(response.headers))
	try:
		result = jsonify(responseBody=str(response.text), status=str(response.status_code), headers=headers_json);
	except ValueError:
		# no JSON returned
		result = jsonify(status=str(response.status_code), reason=response.reason);
	return result;


@app.route('/tools/getCommand', methods = ["POST"])
def getCommand():
	data = request.get_json();
	url = data['url'];
	if 'tenantID' in data:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  'Content-Type': 'application/json',
		  'TenantID': data['tenantID']
		};
	else:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  'Content-Type': 'application/json'
		};
	
	response = requests.request("GET", url, headers=headers);
	#print(response.text)
	#print(response);
	try:
		result = jsonify(json.loads(response.text));
		# ...
	except ValueError:
		# no JSON returned
		result = jsonify(status=str(response.status_code), reason=response.reason, responseBody=str(response.text));
	return result;


@app.route('/tools/getCommandwHeaders', methods = ["POST"])
def getCommandwHeaders():
	data = request.get_json();
	url = data['url'];
	if 'tenantID' in data:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  'Content-Type': 'application/json',
		  'TenantID': data['tenantID']
		};
	else:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  'Content-Type': 'application/json'
		};
	
	response = requests.request("GET", url, headers=headers);
	headers_json = json.dumps(dict(response.headers))
	try:
		result = jsonify(responseBody=str(response.text), status=str(response.status_code), headers=headers_json);
		# ...
	except ValueError:
		# no JSON returned
		result = jsonify(responseBody=str(response.text), status=str(response.status_code), reason=response.reason);
	return result;
	
	
	
@app.route('/tools/postCommand', methods = ["POST"])
def postCommand():
	data = request.get_json();
	url = data['url'];
	
	if 'tenantID' in data:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  'Content-Type': 'application/json',
		  'TenantID': data['tenantID']
		};
	else:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  'Content-Type': 'application/json'
		};

	if 'data' in data:
		payload = data['data'];
		response = requests.request("POST", url, headers=headers, data=payload);
	else:
		response = requests.request("POST", url, headers=headers);

	#app.logger.debug(response.text)
	
	try:
		result = jsonify(json.loads(response.text));
		# ...
	except ValueError:
		# no JSON returned
		app.logger.debug("No JSON")
		result = jsonify(status=str(response.status_code), reason=response.reason);
	return result;
	
	
@app.route('/tools/postFormDataCommand', methods = ["POST"])
def postFormDataCommand():
	data = request.get_json();
	url = data['url'];
	
	if 'tenantID' in data:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  "Accept": "*/*",
		  'TenantID': data['tenantID']
		};
	else:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  "Accept": "*/*"
		};
    
	if 'template' in data:
		payload = data['template'];
		files = {'template': ('template.txt', payload)}
		response = requests.request("POST", url, headers=headers, files=files);
	elif 'variables' in data:
		payload = data['variables'];
		files = {'variables': ('variables.txt', payload)}
		response = requests.request("POST", url, headers=headers, files=files);
	else:
		response = requests.request("POST", url, headers=headers);

	#app.logger.debug(response.text)
	
	try:
		result = jsonify(json.loads(response.text));
		# ...
	except ValueError:
		# no JSON returned
		app.logger.debug("No JSON")
		result = jsonify(status=str(response.status_code), reason=response.reason);
	return result;

	
@app.route('/tools/putCommand', methods = ["POST"])
def putCommand():
	data = request.get_json();
	url = data['url'];
	payload = data['data'];
	
	if 'tenantID' in data:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  'Content-Type': 'application/json',
		  'TenantID': data['tenantID']
		};
	else:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  'Content-Type': 'application/json'
		};
    
	response = requests.request("PUT", url, data=payload, headers=headers);
	
	app.logger.debug(response.text)
	try:
		result = jsonify(json.loads(response.text));
		# ...
	except ValueError:
		# no JSON returned
		result = jsonify(status=str(response.status_code), reason=response.reason);
	return result;


@app.route('/tools/patchFormDataCommand', methods = ["POST"])
def patchFormDataCommand():
	data = request.get_json();
	url = data['url'];
	
	if 'tenantID' in data:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  "Accept": "*/*",
		  'TenantID': data['tenantID']
		};
	else:
		headers = { 
		  'cache-control': "no-cache",
		  'Authorization': 'Bearer ' + data['access_token'],
		  "Accept": "*/*"
		};
    
	if 'template' in data:
		payload = data['template'];
		files = {'template': ('template.txt', payload)}
		response = requests.request("PATCH", url, headers=headers, files=files);
	elif 'variables' in data:
		payload = data['variables'];
		files = {'variables': ('variables.txt', payload)}
		response = requests.request("PATCH", url, headers=headers, files=files);
	else:
		response = requests.request("PATCH", url, headers=headers);

	#app.logger.debug(response.text)
	
	try:
		result = jsonify(json.loads(response.text));
		# ...
	except ValueError:
		# no JSON returned
		app.logger.debug("No JSON")
		result = jsonify(status=str(response.status_code), reason=response.reason);
	return result;


@app.route('/tools/patchCommand', methods = ["POST"])
def patchCommand():
	data = request.get_json();
	url = data['url'];
	payload = data['data'];
	
	if 'tenantID' in data:
		headers = {
			'cache-control': "no-cache",
			'Authorization': 'Bearer ' + data['access_token'],
			'Content-Type': 'application/json',
			'TenantID': data['tenantID']
		};
	else:
		headers = {
			'cache-control': "no-cache",
			'Authorization': 'Bearer ' + data['access_token'],
			'Content-Type': 'application/json'
		};
    
	response = requests.request("PATCH", url, data=payload, headers=headers);
	
	app.logger.debug(response.text)
	try:
		result = jsonify(json.loads(response.text));
		# ...
	except ValueError:
		# no JSON returned
		result = jsonify(status=str(response.status_code), reason=response.reason);
	return result;

	
@app.route('/tools/deleteCommand', methods = ["POST"])
def deleteCommand():
	data = request.get_json();
	url = data['url'];
	
	if 'tenantID' in data:
		headers = {
			'cache-control': "no-cache",
			'Authorization': 'Bearer ' + data['access_token'],
			'Content-Type': 'application/json',
			'TenantID': data['tenantID']
		};
	else:
		headers = {
			'cache-control': "no-cache",
			'Authorization': 'Bearer ' + data['access_token'],
			'Content-Type': 'application/json'
		};
	
	if "data" in data:
		payload = data['data'];
		response = requests.request("DELETE", url, data=payload, headers=headers);
	else:
		response = requests.request("DELETE", url, headers=headers);
	
	app.logger.debug(response.status_code)
	try:
		result = jsonify(json.loads(response.text)), response.status_code;
	except ValueError:
		# no JSON returned
		result = jsonify(status=str(response.status_code), reason=response.reason), response.status_code;
	return result;

		


@app.route("/")
def hello():
    return render_template('index.html')



@app.route("/reachable")
def reachable():
    return flask.request.url_root;


if __name__ == "__main__":
    app.run(host='0.0.0.0', debug=True)
	