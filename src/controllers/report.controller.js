import Appointment from '../models/appointment.model.js';
import { unlinkSync, readFileSync } from 'fs'
import { AWS_CONFIG } from '../shared/constant/application.const.js';
import AWS from 'aws-sdk';
import Report from '../models/report.model.js';


// Configure AWS SDK
AWS.config.update({
	accessKeyId: AWS_CONFIG.accessKeyId,
	secretAccessKey: AWS_CONFIG.secretAccessKey,
	region: AWS_CONFIG.region,
});

export async function newReport(req, res){
	try {
		const doctorId = req.userdata._id;
		const { appointmentId, symptoms, allergies, currentMedications, diagnosis, treatmentPlan } = req.body;
		const file = req.files?.attachments ? req.files.attachments[0] : null;
		
		
		// check for required params
		if(!appointmentId){
			throw new Error("Appointment Id is missing");
		}
		if(!symptoms){
			throw new Error("Symptoms are missing");
		}
		if(!diagnosis){
			throw new Error("No diagnosis submitted");
		}

		// check if patient exists
		const appointment = await Appointment.findOne({ _id: appointmentId, status: 'Completed' }).lean();
		if(!appointment){
			throw new Error("Appointment does not exist.");
		}

		let fileName;
		let fullFileName;
		// check if file is sent alongside other form data
		if (file) {
			//check if file uploaded is an image and delete file from server if it's not an image file
			if(file.mimetype.split("/")[0] !== "image" && file.mimetype !== "application/pdf"){
				unlinkSync(`${file.destination}/${file.filename}`);
				throw new Error("File uploaded is not an image");
			}
			var fileExtension
			if(file.mimetype.startsWith("image/")) {
				fileExtension = ".png";
			} else if (file.mimetype === "application/pdf") {
				fileExtension = ".pdf";
			}

			const fileContent = readFileSync(`${file.destination}/${file.filename}`);
			fileName = `${appointmentId}-${Date.now()}${fileExtension}`;

			const s3 = new AWS.S3();
			const s3Params = {
				Bucket: process.env.Aws_Bucket_Name,
				Key: fileName,
				Body: fileContent,
				ContentType: file.mimetype,
			};

			const s3Response = await s3.upload(s3Params).promise();
			// let cloudfileName = s3Response.Location;
			fullFileName = `${process.env.CloudFrontURL}/${fileName}`;
			console.log('File uploaded to S3:', s3Response.Location);
			console.log('File link at:', fullFileName);
			
			try {
				unlinkSync(`${file.destination}/${file.filename}.png`);
			} catch (err) {
				console.error('Error deleting file:', err.message);
			}
		}

		// "unstringifying" medication object items
		const medications = [];
		for (let i = 0; i < currentMedications.length; i++) {
			if (currentMedications[i]) {
				try {
					medications.push(JSON.parse(currentMedications[i]));
				} catch (error) {
					console.error('Error parsing medication:', error);
				}
			}
		}
		const report = await Report.create({
			doctorId: doctorId,
			userId: appointment.userId,
			appointmentId,
			symptoms,
			allergies,
			currentMedications: JSON.parse(currentMedications),
			diagnosis,
			treatmentPlan,
			attachments: fullFileName
		})
		

		return res.status(200).send({
			success: true,
			data: report,
			message: "Report saved successfully..!",
		});
	} catch (error) {
		console.log("error====>", error);
		return res.status(500).send({
			success: false,
			error: error.message,
			message: error.message,
		});
	}
}


export async function updateReport(req, res){
	try {
		const doctorId = req.userdata._id;
		const { reportId, symptoms, allergies, currentMedications, diagnosis, treatmentPlan } = req.body;
		const file = req.files?.attachments ? req.files.attachments[0] : null;
		
		// check for required params
		if(!reportId){
			throw new Error("Error: Report Id missing");
		}
		if(!symptoms){
			throw new Error("Symptoms are missing");
		}
		if(!diagnosis){
			throw new Error("No diagnosis submitted");
		}

		// check if report exists and created less than 12 hours ago
		const existingReport = await Report.findOne(
			{ _id: reportId }
		);
		if(!existingReport){
			throw new Error("Report with this id does not exist.");
		}
		if (existingReport.createdAt < new Date(Date.now() - 12 * 60 * 60 * 1000)) {
			throw new Error("Report is older than 12 hours. Report can't be edited");
		}

		let fileName;
		let fullFileName;
		// check if file is sent alongside other form data
		if (file) {
			//check if file uploaded is an image and delete file from server if it's not an image file
			if(file.mimetype.split("/")[0] !== "image" && file.mimetype !== "application/pdf"){
				unlinkSync(`${file.destination}/${file.filename}`);
				throw new Error("File uploaded is not an image");
			}
			var fileExtension
			if(file.mimetype.startsWith("image/")) {
				fileExtension = ".png";
			} else if (file.mimetype === "application/pdf") {
				fileExtension = ".pdf";
			} 

			const fileContent = readFileSync(`${file.destination}/${file.filename}`);
			fileName = `${existingReport.appointmentId}-${Date.now()}${fileExtension}`;

			const s3 = new AWS.S3();
			const s3Params = {
				Bucket: process.env.Aws_Bucket_Name,
				Key: fileName,
				Body: fileContent,
				ContentType: file.mimetype,
			};

			const s3Response = await s3.upload(s3Params).promise();
			// let cloudfileName = s3Response.Location;
			fullFileName = `${process.env.CloudFrontURL}/${fileName}`;
			console.log('File uploaded to S3:', s3Response.Location);
			console.log('File link at:', fullFileName);
			
			try {
				unlinkSync(`${file.destination}/${file.filename}.png`);
			} catch (err) {
				console.error('Error deleting file:', err.message);
			}
		}

		

		// "unstringifying" medication object items
		const medications = [];
		for (let i = 0; i < currentMedications.length; i++) {
			if (currentMedications[i]) {
				try {
					medications.push(JSON.parse(currentMedications[i]));
				} catch (error) {
					console.error('Error parsing medication:', error);
				}
			}
		}

		// update report
		const report = await Report.findByIdAndUpdate(
			{ _id: reportId },
			{
				symptoms,
				allergies,
				currentMedications: JSON.parse(currentMedications),
				diagnosis,
				treatmentPlan,
				attachments: fullFileName
			},
			{ new: true }
		);
		
		return res.status(200).send({
			success: true,
			data: report,
			message: "Report updated successfully..!",
		});
	} catch (error) {
		console.log("error====>", error);
		return res.status(500).send({
			success: false,
			error: error.message,
			message: error.message,
		});
	}
}

export async function getReports(req, res){
	try {
		const reports = await Report.find().populate(
			{ path: 'appointmentId', select: '_id name date', as: 'user',  }
		).lean();

		return res.status(200).send({
			success: true,
			data: reports,
			message: "Reports list retrieved successfully..!",
		});
	} catch (error) {
		console.log("error====>", error);
		return res.status(500).send({
			success: false,
			error: error.message,
			message: error.message,
		});
	}
}

export async function getReport(req, res){
	try {
		const { reportId } = req.params;
		if (!reportId) throw new Error('No report selected.');

		const report = await Report.findOne({
			_id: reportId
		}).populate(
			{ path: 'appointmentId', select: '_id name date', as: 'user',  }
		).lean();

		if (!report) throw new Error('Report not found.');

		return res.status(200).send({
			success: true,
			data: report,
			message: "Report retrieved successfully..!",
		});
	} catch (error) {
		console.log("error====>", error);
		return res.status(500).send({
			success: false,
			error: error.message,
			message: error.message,
		});
	}
}

// Set report personal information
export async function deleteReport(req, res) {
	try {
		const userId = req.userdata._id;
		const {reportId} = req.body;
		if (!reportId) throw new Error('No report selected.');

		// check if report exists and created less than 12 hours ago
		const existingReport = await Report.findOne(
			{ _id: reportId }
		);
		if(!existingReport){
			throw new Error("Report with this id does not exist.");
		}
		if (existingReport.createdAt < new Date(Date.now() - 12 * 60 * 60 * 1000)) {
			throw new Error("Report is older than 12 hours. Report can't be edited");
		}

		const report = await Report.deleteOne({
			_id: reportId
		});
		if (!report) throw new Error('Report not found.');

		return res.status(200).send({
			success: true,
			message: "Report deleted successfully..!",
		});
	} catch (error) {
		console.log("error====>", error);
		return res.status(500).send({
			success: false,
			error: error.message,
			message: error.message,
		});
	}
}