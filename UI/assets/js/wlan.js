/*
Central Automation v1.5
Updated: 1.13
Aaron Scott (WiFi Downunder) 2022
*/

var configGroups = [];
var groupConfigs = {};
var wlans = [];

var groupCounter = 0;
var updateCounter = 0;
var errorCounter = 0;
var wlanPrefix = 'wlan ssid-profile ';

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		Array Compare Function
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

// Warn if overriding existing method
if (Array.prototype.equals) console.warn("Overriding existing Array.prototype.equals. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function(array) {
	// if the other array is a falsy value, return
	if (!array) return false;

	// compare lengths - can save a lot of time
	if (this.length != array.length) return false;

	for (var i = 0, l = this.length; i < l; i++) {
		// Check if we have nested arrays
		if (this[i] instanceof Array && array[i] instanceof Array) {
			// recurse into the nested arrays
			if (!this[i].equals(array[i])) return false;
		} else if (this[i] != array[i]) {
			// Warning - two different object instances will never be equal: {x:20} != {x:20}
			return false;
		}
	}
	return true;
};
// Hide method from for-in loops
Object.defineProperty(Array.prototype, 'equals', { enumerable: false });

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		PSK functions (1.2)
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function getWLANsforGroup() {
	showNotification('ca-wifi-protected', 'Obtaining WLANs for selected group configuration', 'bottom', 'center', 'info');
	document.getElementById('pskPassphrase').value = '';
	var wlans = document.getElementById('wlanselector');
	wlans.options.length = 0;

	var select = document.getElementById('groupselector');
	var wlanGroup = select.value;

	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/configuration/v1/wlan/' + wlanGroup,
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/configuration/v1/ap_cli/<GROUP>)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);

		$.each(response.wlans, function() {
			$('#wlanselector').append($('<option>', { value: this['name'], text: this['essid'] }));
		});
		if (response.wlans.length > 0) {
			if ($('.selectpicker').length != 0) {
				$('.selectpicker').selectpicker('refresh');
			}
		} else {
			showNotification('ca-wifi', 'There are no WLANs in the "' + wlanGroup + '" group', 'bottom', 'center', 'danger');
		}
	});
	$('[data-toggle="tooltip"]').tooltip();
}

function getConfigforWLAN() {
	showNotification('ca-wifi-protected', 'Obtaining WLAN configuration', 'bottom', 'center', 'info');
	document.getElementById('pskPassphrase').value = '';
	var groupselect = document.getElementById('groupselector');
	var wlanGroup = groupselect.value;
	var wlanselect = document.getElementById('wlanselector');
	var wlan = wlanselect.value;
	var settings = {
		url: getAPIURL() + '/tools/getCommandwHeaders',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/configuration/v2/wlan/' + wlanGroup + '/' + wlan,
			access_token: localStorage.getItem('access_token'),
		}),
	};

	$.ajax(settings).done(function(commandResults, statusText, xhr) {
		if (commandResults.hasOwnProperty('headers')) {
			updateAPILimits(JSON.parse(commandResults.headers));
		}
		if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
			logError('Central Server Error (503): ' + commandResults.reason + ' (/configuration/v2/wlan/<GROUP>/<WLAN>)');
			apiErrorCount++;
			return;
		} else if (commandResults.hasOwnProperty('error_code')) {
			logError(commandResults.description);
			apiErrorCount++;
			return;
		}
		var response = JSON.parse(commandResults.responseBody);

		if (response.wlan.wpa_passphrase === '') {
			showNotification('ca-wifi-protected', 'The selected WLAN is not a PSK-based network', 'bottom', 'center', 'danger');
			document.getElementById('qrBtn').disabled = true;
		} else {
			//console.log(response.wlan);
			document.getElementById('pskPassphrase').value = response.wlan.wpa_passphrase;
			existingPassphrase = response.wlan.wpa_passphrase;
			document.getElementById('savePSKBtn').disabled = true;
			wlanConfig = response;
			document.getElementById('qrBtn').disabled = false;
		}
	});
}

function updatePSK() {
	var groupselect = document.getElementById('groupselector');
	var wlanGroup = groupselect.value;
	var wlanselect = document.getElementById('wlanselector');
	var wlan = wlanselect.value;
	// update the passphrase value
	wlanConfig['wlan']['wpa_passphrase'] = document.getElementById('pskPassphrase').value;
	wlanConfig['wlan']['wpa_passphrase_changed'] = true;

	showNotification('ca-wifi-protected', 'Updating PSK for ' + wlan, 'bottom', 'center', 'info');

	var settings = {
		url: getAPIURL() + '/tools/putCommand',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/configuration/v2/wlan/' + wlanGroup + '/' + wlan,
			access_token: localStorage.getItem('access_token'),
			data: JSON.stringify(wlanConfig),
		}),
	};

	$.ajax(settings)
		.done(function(response) {
			if (response.hasOwnProperty('status')) {
				if (response.status === '503') {
					logError('Central Server Error (503): ' + response.reason + ' (/configuration/v2/wlan/<GROUP>)');
					return;
				}
			}
			if (response === wlan) {
				Swal.fire({
					title: 'Passphrase Updated',
					text: 'Passphrase was updated for the "' + wlan + '" WLAN',
					icon: 'success',
				});
			}
		})
		.fail(function(XMLHttpRequest, textStatus, errorThrown) {
			console.log('error');
			console.log(textStatus);
			if (XMLHttpRequest.readyState == 4) {
				// HTTP error (can be checked by XMLHttpRequest.status and XMLHttpRequest.statusText)
				showNotification('ca-globe', XMLHttpRequest.statusText, 'bottom', 'center', 'danger');
			} else if (XMLHttpRequest.readyState == 0) {
				// Network error (i.e. connection refused, access denied due to CORS, etc.)
				showNotification('ca-globe', 'Can not connect to API server', 'bottom', 'center', 'danger');
			} else {
				// something weird is happening
			}
		});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		PSK UI functions (1.2)
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function passphraseChange() {
	if (document.getElementById('pskPassphrase').value === existingPassphrase) {
		document.getElementById('savePSKBtn').disabled = false;
	} else {
		document.getElementById('savePSKBtn').disabled = false;
	}
}

function showPassphrase() {
	var x = document.getElementById('pskPassphrase');
	if (document.getElementById('revealPassphrase').checked) {
		x.type = 'text';
	} else {
		x.type = 'password';
	}
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
	QR Code functions (1.12)
------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function generateQRCode() {
	// Get needed values
	var wlanselect = document.getElementById('wlanselector');
	var wlan = wlanselect.value;
	var psk = document.getElementById('pskPassphrase').value;
	var hidden = wlanConfig.wlan.hide_ssid;

	var enc = 'WPA';
	// Label the modal
	document.getElementById('wlanQRTitle').innerHTML = 'WLAN QR Code for ' + wlan;

	// Are we using a custom colour?
	var qrColor = localStorage.getItem('qr_color');
	if (qrColor == null || qrColor == 'undefined') {
		// use the default colour - Aruba Orange
		qrColor = '#FF8300';
	}

	// Custom Logo?
	var qrLogo = localStorage.getItem('qr_logo');
	if (qrLogo == null || qrLogo == 'undefined' || qrLogo === '') {
		qrLogo = 'assets/img/api.svg';
	}

	// Generate the QR Code and display
	$('#qrcanvas').empty();
	const qrCode = new QRCodeStyling({
		width: 400,
		height: 400,
		type: 'svg',
		data: 'WIFI:S:' + wlan + ';T:' + enc + ';P:' + psk + ';H:' + hidden + ';;',
		image: qrLogo,
		dotsOptions: {
			color: qrColor,
			type: 'rounded',
		},
		cornersDotOptions: {
			color: qrColor,
			type: 'dot',
		},
		backgroundOptions: {
			color: '#ffffff',
		},
		imageOptions: {
			crossOrigin: 'anonymous',
			margin: 10,
		},
	});

	qrCode.append(document.getElementById('qrcanvas'));
	qrCode.download({ name: wlan + '-qr', extension: 'png' });
	$('#QRModalLink').trigger('click');
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		WLAN functions (1.13)
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function getWLANs() {
	$.when(tokenRefresh()).then(function() {
		//$.when(getGroupData(0)).then(function () {
		// Clearing old data
		$('#wlan-table')
			.DataTable()
			.clear();
		configGroups = getGroups();
		groupCounter = 0;
		groupConfigs = {};
		wlans = [];
		showNotification('ca-folder-settings', 'Getting Group WLAN Configs...', 'bottom', 'center', 'info');

		// Grab config for each Group in Central
		$.each(configGroups, function() {
			var currentGroup = this.group;
			var settings = {
				url: getAPIURL() + '/tools/getCommandwHeaders',
				method: 'POST',
				timeout: 0,
				headers: {
					'Content-Type': 'application/json',
				},
				data: JSON.stringify({
					url: localStorage.getItem('base_url') + '/configuration/v1/ap_cli/' + currentGroup,
					access_token: localStorage.getItem('access_token'),
				}),
			};

			$.ajax(settings).done(function(commandResults, statusText, xhr) {
				if (commandResults.hasOwnProperty('headers')) {
					updateAPILimits(JSON.parse(commandResults.headers));
				}
				if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
					logError('Central Server Error (503): ' + commandResults.reason + ' (/configuration/v1/ap_cli/<GROUP>)');
					apiErrorCount++;
					return;
				} else if (commandResults.hasOwnProperty('error_code')) {
					logError(commandResults.description);
					apiErrorCount++;
					return;
				}
				var response = JSON.parse(commandResults.responseBody);

				// save the group config for modifications
				groupConfigs[currentGroup] = response;
				// pull the roles out of each group config
				getWLANsFromConfig(response, currentGroup);
				groupCounter++;
				if (groupCounter == configGroups.length) {
					// Build table of user roles
					var table = $('#wlan-table').DataTable();
					for (i = 0; i < wlans.length; i++) {
						//console.log(wlans[i]['config']);
						// Pull additional info out
						var keyMgmt = '';
						var fastRoaming = [];
						var mbr;
						var mbr2 = '1';
						var mbr5 = '6';
						var apZone = '';
						var rfBand = 'All';
						var rfBand6 = false;
						$.each(wlans[i]['config'], function() {
							if (this.includes('opmode ')) keyMgmt = this.replace('opmode ', '');
							if (this.includes('g-min-tx-rate ')) mbr2 = this.replace('g-min-tx-rate ', '');
							if (this.includes('a-min-tx-rate ')) mbr5 = this.replace('a-min-tx-rate ', '');
							if (this.includes('dot11k')) fastRoaming.push('11k');
							if (this.includes('dot11v')) fastRoaming.push('11v');
							if (this.includes('dot11r')) fastRoaming.push('11r');
							if (this.includes('zone')) apZone = this.replace('zone ', '');
							if (this.includes('rf-band ')) rfBand = this.replace('rf-band ', '');
							if (this.includes('rf-band-6ghz')) rfBand6 = true;
						});
						fastRoaming.sort();
						mbr = '2.4GHz: ' + mbr2 + 'Mbps / 5GHz: ' + mbr5 + 'Mbps';
						if (rfBand === '5.0') rfBand = '5';
						if (rfBand !== 'All' && rfBand6) rfBand += 'GHz/6GHz';
						if (rfBand !== 'All' && !rfBand6) rfBand += 'GHz';

						// Action Buttons
						var actionBtns = '<a class="btn btn-link btn-warning" data-toggle="tooltip" data-placement="top" title="Edit WLAN" onclick="loadWLANUI(\'' + i + '\')"><i class="fa-regular fa-pencil"></i></a> ';
						if (wlans[i]['config'].indexOf('disable') != -1) {
							actionBtns += '<a class="btn btn-link btn-neutral" data-toggle="tooltip" data-placement="top" title="Enable WLAN" onclick="enableWLAN(\'' + i + '\',true)"><i class="fa-regular fa-wifi"></i></a>';
						} else {
							actionBtns += '<a class="btn btn-link btn-warning" data-toggle="tooltip" data-placement="top" title="Disable WLAN" onclick="enableWLAN(\'' + i + '\',false)"><i class="fa-regular fa-wifi"></i></a>';
						}

						// Add row to table
						table.row.add([i, '<strong>' + wlans[i]['name'] + '</strong>', wlans[i]['groups'].join(', '), rfBand, keyMgmt, mbr, fastRoaming.join('/'), apZone, actionBtns]);
					}
					$('#wlan-table')
						.DataTable()
						.rows()
						.draw();

					showNotification('ca-folder-settings', 'Retrieved Group WLAN Configs...', 'bottom', 'center', 'success');
					$('[data-toggle="tooltip"]').tooltip();
				}
			});
		});
		//})
	});
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		WLAN Functions
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function getConfigforGroup() {
	var select = document.getElementById('groupselector');
	var wlanGroup = select.value;

	if (groupConfigs[wlanGroup].hasOwnProperty('error_code')) {
		document.getElementById('wlanConfig').value = '';
	} else {
		document.getElementById('wlanConfig').value = groupConfigs[wlanGroup].join('\n');
	}
}

function getPSKForWLAN(wlanGroup, wlan) {
	if (!wlan.includes(' ')) {
		var settings = {
			url: getAPIURL() + '/tools/getCommandwHeaders',
			method: 'POST',
			timeout: 0,
			headers: {
				'Content-Type': 'application/json',
			},
			data: JSON.stringify({
				url: localStorage.getItem('base_url') + '/configuration/v2/wlan/' + wlanGroup + '/' + wlan,
				access_token: localStorage.getItem('access_token'),
			}),
		};

		$.ajax(settings).done(function(commandResults, statusText, xhr) {
			if (commandResults.hasOwnProperty('headers')) {
				updateAPILimits(JSON.parse(commandResults.headers));
			}
			if (commandResults.hasOwnProperty('status') && commandResults.status === '503') {
				logError('Central Server Error (503): ' + commandResults.reason + ' (/configuration/v2/wlan/<GROUP>/<WLAN>)');
				apiErrorCount++;
				return;
			} else if (commandResults.hasOwnProperty('error_code')) {
				logError(commandResults.description);
				apiErrorCount++;
				return;
			}
			var response = JSON.parse(commandResults.responseBody);

			if (response.wlan && response.wlan.wpa_passphrase) {
				var passphrase = response.wlan.wpa_passphrase;
				$.each(wlans, function() {
					// find the WLAN and update the line with the actual PSK
					if (this.name === wlan && this.groups.includes(wlanGroup)) {
						// found the matching wlan
						var config = this.config;
						for (i = 0; i < config.length; i++) {
							if (config[i].includes('wpa-passphrase')) {
								this.config[i] = 'wpa-passphrase ' + passphrase;
							}
						}
					}
				});
			}
		});
	}
}

function getWLANsFromConfig(config, group) {
	// Find the existing user role
	var startIndex = -1;
	var endIndex = -1;
	var wlanName = '';

	// check if is a UI group (this doesn't work for template groups... yet)
	if (config.length) {
		for (i = 0; i < config.length; i++) {
			var currentLine = config[i];

			// Find first row of the user role
			if (currentLine.includes(wlanPrefix) && startIndex == -1) {
				// pull out the wlan name.
				wlanName = currentLine.replace(wlanPrefix, '');
				startIndex = i;
			} else if (endIndex == -1 && startIndex != -1 && !currentLine.includes('  ')) {
				// next line after the end of the current role
				endIndex = i;
			}

			if (endIndex != -1 && startIndex != -1) {
				// Found the start and end of a WLAN
				// Build the WLAN from the config.
				// No need to keep the first line - since we already have the wlanName, the first line can be rebuilt.
				var fullWLAN = config.slice(startIndex + 1, endIndex);

				var finalWLAN = [];
				// Remove the "index #" line and "utf8"
				$.each(fullWLAN, function() {
					if (!this.includes('utf8') && !this.includes('index ')) finalWLAN.push(this.trim());
					if (this.trim().includes('-psk-') || this.trim().includes('wpa3-sae')) getPSKForWLAN(group, wlanName);
				});

				// Check if we have already found the exact same role in another group
				var existingWLANMatch = false;
				$.each(wlans, function() {
					if (this['name'] === wlanName) {
						// Role with this name exists - now check if the rules are the same.
						if (this['config'].equals(finalWLAN)) {
							// exactly the same ACLs for the same role name. add group name to record.
							var groupList = this['groups'];
							groupList.push(group);
							this['groups'] = groupList;
							existingWLANMatch = true;
							return false;
						}
					}
				});

				// No existing exact match. Need to add record.
				if (!existingWLANMatch) {
					var groupList = [];
					groupList.push(group);
					// Currently do not support WLANs with spaces in the name
					if (!wlanName.includes(' ')) {
						wlans.push({ name: wlanName, config: finalWLAN, groups: groupList });
					}
				}

				// Is the current line another WLAN?
				if (currentLine.includes(wlanPrefix)) {
					wlanName = currentLine.replace(wlanPrefix, '');
					startIndex = i;
					endIndex = -1;
				} else {
					// Not another WLAN - rest of the config shouldn't contain any WLANs so break out of loop
					break;
				}
			}
		}
	}
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		WLAN UI Functions
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */
function loadCurrentPageGroup() {
	getWLANs();
}

function loadWLANUI(wlanIndex) {
	var wlan = wlans[wlanIndex];
	document.getElementById('wlanName').value = wlan.name;
	document.getElementById('wlanConfig').value = wlan.config.join('\n');

	// load selectPicker with Groups
	select = document.getElementById('modalGroupSelector');
	select.options.length = 0;
	$.each(configGroups, function() {
		var currentGroup = this.group;
		$('#modalGroupSelector').append($('<option>', { value: currentGroup, text: currentGroup }));
		if ($('.selectpicker').length != 0) {
			$('.selectpicker').selectpicker('refresh');
		}
		$.each(wlan.groups, function(idx, val) {
			$("select option[value='" + val + "']").prop('selected', true);
		});
	});
	checkSelectionCount();
	$('#WLANModalLink').trigger('click');
}

function checkSelectionCount() {
	var select = document.getElementById('modalGroupSelector');
	var selectedGroups = [...select.selectedOptions].map(option => option.value);
	if (selectedGroups.length == 0) {
		document.getElementById('saveWLANBtn').disabled = true;
		document.getElementById('selectAllGroups').checked = false;
	} else if (selectedGroups.length == configGroups.length) {
		document.getElementById('saveWLANBtn').disabled = true;
		document.getElementById('selectAllGroups').checked = true;
	} else {
		document.getElementById('saveWLANBtn').disabled = false;
		document.getElementById('selectAllGroups').checked = false;
	}
}

function selectAll() {
	$.each(configGroups, function(idx, val) {
		$("select option[value='" + val.group + "']").prop('selected', document.getElementById('selectAllGroups').checked);
	});
	$('.selectpicker').selectpicker('refresh');

	if (document.getElementById('selectAllGroups').checked) {
		document.getElementById('saveWLANBtn').disabled = false;
	} else {
		document.getElementById('saveWLANBtn').disabled = true;
	}
}

/*  -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
		WLAN Creation/Modification Functions
	------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

function checkForDuplicateWLANName(newName) {
	var duplicate = false;
	$.each(wlans, function() {
		if (newName === this['name']) {
			duplicate = true;
			return false;
		}
	});
	return duplicate;
}

function updateWLAN(addingWLAN) {
	updateCounter = 0;
	errorCounter = 0;
	clearErrorLog();

	// get WLAN name
	var newWLANName = document.getElementById('wlanName').value;

	// If we are going to be adding the WLAN - then prep the config with the required formatting
	if (addingWLAN) {
		var newConfig = document.getElementById('wlanConfig').value;
		var newConfigArray = [];
		var tempConfigArray = newConfig.split('\n');
		// Add indent to the config
		for (i = 0; i < tempConfigArray.length; i++) {
			newConfigArray.push('  ' + tempConfigArray[i]);
		}
	}

	// get selected Groups
	var select = document.getElementById('modalGroupSelector');
	var selectedGroups = [...select.selectedOptions].map(option => option.value);

	// Loop through the groups and grab the stored config
	showNotification('ca-folder-settings', 'Updating Group WLAN Configs...', 'bottom', 'center', 'info');
	$.each(selectedGroups, function() {
		var currentConfig = groupConfigs[this];
		var currentGroup = this;

		// Find if there is an existing WLAN
		var startIndex = -1;
		var endIndex = -1;
		var firstWLANLocation = -1;

		var lineToFind = wlanPrefix + newWLANName;
		for (i = 0; i < currentConfig.length; i++) {
			if (currentConfig[i].includes(wlanPrefix) && firstWLANLocation == -1) {
				// grab the location of the first user role - in case the role we are looking for isnt in the config
				firstWLANLocation = i;
			}
			if (currentConfig[i] === lineToFind) {
				startIndex = i;
			} else if (endIndex == -1 && startIndex != -1 && !currentConfig[i].includes('  ')) {
				endIndex = i;
			}
		}

		if (startIndex == -1) {
			// no existing user role. Find the first user role and place this role before it.
			startIndex = firstWLANLocation;
		} else {
			// remove the existing role from the config
			currentConfig.splice(startIndex, endIndex - startIndex);
		}

		// If the desired result is to add the new/updated role into the config for this group
		if (addingWLAN) {
			// build new role
			var newWLAN = [];
			newWLAN.push(wlanPrefix + newWLANName);
			newWLAN.push(...newConfigArray);

			// Splice the new role into the config
			if (currentConfig.length) {
				currentConfig.splice(startIndex, 0, ...newWLAN);
			} else {
				currentConfig = newWLAN;
			}
		}

		// need to push config back to Central.
		var settings = {
			url: getAPIURL() + '/tools/postCommand',
			method: 'POST',
			timeout: 0,
			headers: {
				'Content-Type': 'application/json',
			},
			data: JSON.stringify({
				url: localStorage.getItem('base_url') + '/configuration/v1/ap_cli/' + currentGroup,
				access_token: localStorage.getItem('access_token'),
				data: JSON.stringify({ clis: currentConfig }),
			}),
		};

		$.ajax(settings).done(function(response) {
			if (response.hasOwnProperty('status')) {
				if (response.status === '503') {
					logError('Central Server Error (503): ' + response.reason + ' (/configuration/v1/ap_cli/<GROUP>)');
					return;
				}
			}
			updateCounter++;
			if (response.reason && response.reason == 'Bad Gateway') {
				Swal.fire({
					title: 'API Issue',
					text: 'There is an issue communicating with the API Gateway',
					icon: 'warning',
				});
			} else if (response.code && response.code == 429) {
				console.log('errorCode');
				logError('User role was not applied to group ' + currentGroup);
				Swal.fire({
					title: 'API Limit Reached',
					text: 'You have reached your daily API limit. No more API calls will succeed today.',
					icon: 'warning',
				});
			} else if (response.description) {
				logError(response.description);
				errorCounter++;
			} else if (response !== '' + currentGroup) {
				logError('WLAN change was not applied to group ' + currentGroup);
				errorCounter++;
			}
			if (updateCounter == selectedGroups.length) {
				if (errorCounter != 0) {
					showLog();
					Swal.fire({
						title: 'WLAN Deployment',
						text: addingWLAN ? 'The WLAN failed to be deployed to some or all of the selected Groups' : 'The WLAN failed to be removed to some or all of the selected Groups',
						icon: 'error',
					});
				} else {
					Swal.fire({
						title: 'WLAN Deployment',
						text: addingWLAN ? 'WLAN was deployed to all selected Groups' : 'WLAN was removed to all selected Groups',
						icon: 'success',
					});
					getWLANs();
				}
			}
		});
	});
}

function enableWLAN(wlanIndex, wlanEnable) {
	updateCounter = 0;
	errorCounter = 0;
	clearErrorLog();

	// Get selected WLAN and update the enable/disable
	var wlan = wlans[wlanIndex];
	var wlanName = wlan.name;
	var wlanGroups = wlan.groups;
	var wlanConfig = wlan.config;
	if (wlanEnable) {
		var enableRow = wlanConfig.indexOf('disable');
		wlanConfig[enableRow] = 'enable';
	} else {
		var disableRow = wlanConfig.indexOf('enable');
		wlanConfig[disableRow] = 'disable';
	}

	// prep the config with the required formatting
	var newConfigArray = [];
	for (i = 0; i < wlanConfig.length; i++) {
		newConfigArray.push('  ' + wlanConfig[i]);
	}

	// Loop through the groups and grab the stored config
	showNotification('ca-folder-settings', 'Updating Group WLAN Configs...', 'bottom', 'center', 'info');
	$.each(wlanGroups, function() {
		var currentConfig = groupConfigs[this];
		var currentGroup = this;

		// Find if there is an existing WLAN
		var startIndex = -1;
		var endIndex = -1;
		var firstWLANLocation = -1;

		var lineToFind = wlanPrefix + wlanName;
		for (i = 0; i < currentConfig.length; i++) {
			if (currentConfig[i].includes(wlanPrefix) && firstWLANLocation == -1) {
				// grab the location of the first user role - in case the role we are looking for isnt in the config
				firstWLANLocation = i;
			}
			if (currentConfig[i] === lineToFind) {
				startIndex = i;
			} else if (endIndex == -1 && startIndex != -1 && !currentConfig[i].includes('  ')) {
				endIndex = i;
			}
		}

		if (startIndex == -1) {
			// no existing user role. Find the first user role and place this role before it.
			startIndex = firstWLANLocation;
		} else {
			// remove the existing role from the config
			currentConfig.splice(startIndex, endIndex - startIndex);
		}

		// If the desired result is to add the new/updated wlan into the config for this group
		var newWLAN = [];
		newWLAN.push(wlanPrefix + wlanName);
		newWLAN.push(...newConfigArray);

		// Splice the new role into the config
		if (currentConfig.length) {
			currentConfig.splice(startIndex, 0, ...newWLAN);
		} else {
			currentConfig = newWLAN;
		}

		// need to push config back to Central.
		var settings = {
			url: getAPIURL() + '/tools/postCommand',
			method: 'POST',
			timeout: 0,
			headers: {
				'Content-Type': 'application/json',
			},
			data: JSON.stringify({
				url: localStorage.getItem('base_url') + '/configuration/v1/ap_cli/' + currentGroup,
				access_token: localStorage.getItem('access_token'),
				data: JSON.stringify({ clis: currentConfig }),
			}),
		};

		$.ajax(settings).done(function(response) {
			if (response.hasOwnProperty('status')) {
				if (response.status === '503') {
					logError('Central Server Error (503): ' + response.reason + ' (/configuration/v1/ap_cli/<GROUP>)');
					return;
				}
			}
			updateCounter++;
			if (response.reason && response.reason == 'Bad Gateway') {
				Swal.fire({
					title: 'API Issue',
					text: 'There is an issue communicating with the API Gateway',
					icon: 'warning',
				});
			} else if (response.code && response.code == 429) {
				console.log('errorCode');
				logError('User role was not applied to group ' + currentGroup);
				Swal.fire({
					title: 'API Limit Reached',
					text: 'You have reached your daily API limit. No more API calls will succeed today.',
					icon: 'warning',
				});
			} else if (response.description) {
				logError(response.description);
				errorCounter++;
			} else if (response !== '' + currentGroup) {
				logError('WLAN change was not applied to group ' + currentGroup);
				errorCounter++;
			}
			if (updateCounter == wlanGroups.length) {
				if (errorCounter != 0) {
					showLog();
					Swal.fire({
						title: 'WLAN Deployment',
						text: wlanEnable ? 'The WLAN failed to be enabled to some or all of the selected Groups' : 'The WLAN failed to be disabled to some or all of the selected Groups',
						icon: 'error',
					});
				} else {
					Swal.fire({
						title: 'WLAN Deployment',
						text: wlanEnable ? 'The WLAN was enabled on all of the selected Groups' : 'The WLAN was disabled on all of the selected Groups',
						icon: 'success',
					});
					getWLANs();
				}
			}
		});
	});
}

function updateFullWLAN() {
	errorCounter = 0;
	clearErrorLog();

	var select = document.getElementById('groupselector');
	var currentGroup = select.value;

	var newConfig = document.getElementById('wlanConfig').value;
	var currentConfig = newConfig.split('\n');

	showNotification('ca-folder-settings', 'Updating Group WLAN Configs...', 'bottom', 'center', 'info');

	// need to push config back to Central.
	var settings = {
		url: getAPIURL() + '/tools/postCommand',
		method: 'POST',
		timeout: 0,
		headers: {
			'Content-Type': 'application/json',
		},
		data: JSON.stringify({
			url: localStorage.getItem('base_url') + '/configuration/v1/ap_cli/' + currentGroup,
			access_token: localStorage.getItem('access_token'),
			data: JSON.stringify({ clis: currentConfig }),
		}),
	};

	$.ajax(settings).done(function(response) {
		if (response.hasOwnProperty('status')) {
			if (response.status === '503') {
				logError('Central Server Error (503): ' + response.reason + ' (/configuration/v1/ap_cli/<GROUP>)');
				return;
			}
		}
		if (response.reason && response.reason == 'Bad Gateway') {
			Swal.fire({
				title: 'API Issue',
				text: 'There is an issue communicating with the API Gateway',
				icon: 'warning',
			});
		} else if (response.code && response.code == 429) {
			console.log('errorCode');
			logError('User role was not applied to group ' + currentGroup);
			Swal.fire({
				title: 'API Limit Reached',
				text: 'You have reached your daily API limit. No more API calls will succeed today.',
				icon: 'warning',
			});
		} else if (response.description) {
			logError(response.description);
			errorCounter++;
		} else if (response !== '' + currentGroup) {
			logError('WLAN change was not applied to group ' + currentGroup);
			errorCounter++;
		}
		if (errorCounter != 0) {
			showLog();
			Swal.fire({
				title: 'WLAN Configuration',
				text: 'The WLAN configuration failed to be deployed for the selected Group',
				icon: 'error',
			});
		} else {
			Swal.fire({
				title: 'WLAN Configuration',
				text: 'WLAN was deployed to the ' + currentGroup + ' group',
				icon: 'success',
			});
			getWLANs();
		}
	});
}
