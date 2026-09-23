import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  constants,
  generateKeyPairSync,
  privateDecrypt,
} from "crypto";

import { AppDataSource } from "../config/database";
import { User } from "../entities/User";

const userRepository =
  AppDataSource.getRepository(User);

/*
 * RSA KEY PAIR
 *
 * The backend keeps the private key.
 * The frontend receives only the public key.
 *
 * IMPORTANT:
 * The same key pair is used for the lifetime
 * of this backend process.
 */
const {
  publicKey,
  privateKey,
} = generateKeyPairSync("rsa", {
  modulusLength: 2048,

  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },

  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

/*
 * GET PUBLIC KEY
 */
export const getPublicKey = (
  _req: Request,
  res: Response
): void => {
  res.status(200).json({
    publicKey,
  });
};

/*
 * DECRYPT PASSWORD
 */
const decryptPassword = (
  encryptedPassword: string
): string => {
  if (!encryptedPassword) {
    throw new Error(
      "Encrypted password is empty."
    );
  }

  const encryptedBuffer =
    Buffer.from(
      encryptedPassword,
      "base64"
    );

  const decryptedBuffer =
    privateDecrypt(
      {
        key: privateKey,
        padding:
          constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      encryptedBuffer
    );

  return decryptedBuffer.toString(
    "utf8"
  );
};

/*
 * REGISTER
 */
export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      email,
      encryptedPassword,
    } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof encryptedPassword !== "string"
    ) {
      res.status(400).json({
        message:
          "Name, email and encrypted password are required",
      });

      return;
    }

    const normalizedName =
      name.trim();

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedName) {
      res.status(400).json({
        message: "Name is required",
      });

      return;
    }

    if (!normalizedEmail) {
      res.status(400).json({
        message: "Email is required",
      });

      return;
    }

    /*
     * Decrypt password
     */
    let password: string;

    try {
      password =
        decryptPassword(
          encryptedPassword
        );
    } catch (error) {
      console.error(
        "REGISTER PASSWORD DECRYPTION FAILED:",
        error
      );

      res.status(400).json({
        message:
          "Invalid encrypted password",
      });

      return;
    }

    if (!password) {
      res.status(400).json({
        message: "Password is required",
      });

      return;
    }

    /*
     * Check existing user
     */
    const existingUser =
      await userRepository.findOne({
        where: {
          email: normalizedEmail,
        },
      });

    if (existingUser) {
      res.status(409).json({
        message:
          "Email already registered",
      });

      return;
    }

    /*
     * Hash password
     */
    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    const user =
      userRepository.create({
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
      });

    await userRepository.save(user);

    console.log(
      `User registered successfully: ${normalizedEmail}`
    );

    res.status(201).json({
      message:
        "User registered successfully",

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Internal server error",
    });
  }
};

/*
 * LOGIN
 */
export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      email,
      encryptedPassword,
    } = req.body;

    /*
     * Validate request
     */
    if (
      typeof email !== "string" ||
      typeof encryptedPassword !==
        "string"
    ) {
      res.status(400).json({
        message:
          "Email and encrypted password are required",
      });

      return;
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      res.status(401).json({
        message:
          "Invalid email or password",
      });

      return;
    }

    /*
     * Decrypt password
     */
    let password: string;

    try {
      password =
        decryptPassword(
          encryptedPassword
        );
    } catch (error) {
      console.error(
        "LOGIN PASSWORD DECRYPTION FAILED:",
        error
      );

      res.status(401).json({
        message:
          "Invalid email or password",
      });

      return;
    }

    if (!password) {
      console.error(
        "LOGIN PASSWORD IS EMPTY"
      );

      res.status(401).json({
        message:
          "Invalid email or password",
      });

      return;
    }

    /*
     * Find user
     */
    const user = await userRepository
  .createQueryBuilder("user")
  .where("LOWER(user.email) = LOWER(:email)", {
    email,
  })
  .getOne();

    if (!user) {
      console.error(
        `LOGIN USER NOT FOUND: ${normalizedEmail}`
      );

      res.status(401).json({
        message:
          "Invalid email or password",
      });

      return;
    }

    /*
     * Compare password
     */
    const isPasswordValid =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isPasswordValid) {
      console.error(
        `LOGIN PASSWORD MISMATCH: ${normalizedEmail}`
      );

      res.status(401).json({
        message:
          "Invalid email or password",
      });

      return;
    }

    /*
     * JWT
     */
    const secret =
      process.env.JWT_SECRET;

    if (!secret) {
      console.error(
        "JWT_SECRET is missing."
      );

      res.status(500).json({
        message:
          "JWT secret is not configured",
      });

      return;
    }

    const token =
      jwt.sign(
        {
          userId: user.id,
          email: user.email,
        },
        secret,
        {
          expiresIn: "7d",
        }
      );

    console.log(
      `LOGIN SUCCESS: ${normalizedEmail}`
    );

    res.status(200).json({
      message:
        "Login successful",

      token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    res.status(500).json({
      message:
        "Internal server error",
    });
  }
};