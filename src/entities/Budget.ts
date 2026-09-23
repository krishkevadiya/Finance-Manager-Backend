import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "./User";
import { Category } from "./Category";

@Entity("budgets")
@Unique(["userId", "categoryId", "year", "month"])
@Index(["userId", "year", "month"])
export class Budget {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: "decimal",
    precision: 12,
    scale: 2,
  })
  amount!: number;

  @Column()
  year!: number;

  @Column()
  month!: number;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column()
  userId!: number;

  @ManyToOne(() => Category, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "categoryId" })
  category!: Category;

  @Column()
  categoryId!: number;

  @CreateDateColumn()
  createdAt!: Date;
}